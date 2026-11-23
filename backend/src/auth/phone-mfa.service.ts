import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import { SmsService } from './sms.service';
import {
  generatePhoneCode,
  hashPhoneCode,
  maskPhone,
  normalizePhone,
  phoneCodesMatch,
  phoneLast4,
} from './phone-mfa.util';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

interface UserPhoneRow {
  id: string;
  phone_e164: string | null;
  phone_verified_at: string | null;
}

interface ChallengeRow {
  id: string;
  phone_e164: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
}

@Injectable()
export class PhoneMfaService {
  private readonly logger = new Logger(PhoneMfaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  private pepper(): string {
    return (
      this.config.get<string>('MFA_CODE_PEPPER')?.trim() ||
      this.config.get<string>('SUPABASE_SERVICE_KEY')?.trim() ||
      'dev-only-phone-mfa-pepper'
    );
  }

  private async loadUser(firebaseUid: string): Promise<UserPhoneRow> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, phone_e164, phone_verified_at')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();
    if (error || !data) {
      throw new BadRequestException(
        'Finish creating your account, then verify your mobile number.',
      );
    }
    return data as UserPhoneRow;
  }

  private async assertSendBudget(userId: string, phone: string): Promise<void> {
    const supabase = getSupabaseClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [byUser, byPhone] = await Promise.all([
      supabase
        .from('phone_mfa_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since),
      supabase
        .from('phone_mfa_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('phone_e164', phone)
        .gte('created_at', since),
    ]);
    const userCount = byUser.count ?? 0;
    const phoneCount = byPhone.count ?? 0;
    if (userCount >= MAX_SENDS_PER_HOUR || phoneCount >= MAX_SENDS_PER_HOUR) {
      throw new HttpException(
        'Too many text codes. Wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async sendCode(
    firebaseUid: string,
    requestedPhone?: string,
  ): Promise<{ sent: true; phoneLast4: string; enrolled: boolean }> {
    const user = await this.loadUser(firebaseUid);
    const enrolled = Boolean(user.phone_verified_at && user.phone_e164);
    const phone = enrolled
      ? user.phone_e164!
      : normalizePhone(requestedPhone ?? '');

    if (!enrolled) {
      const supabase = getSupabaseClient();
      const { data: owner, error } = await supabase
        .from('users')
        .select('id')
        .eq('phone_e164', phone)
        .maybeSingle();
      if (error) {
        throw new BadRequestException('Could not check that mobile number.');
      }
      if (owner && owner.id !== user.id) {
        throw new ConflictException(
          'That mobile number is already verified on another account. Each number can only be used once.',
        );
      }
    }

    const supabase = getSupabaseClient();
    const { data: recent } = await supabase
      .from('phone_mfa_challenges')
      .select('id, created_at, phone_e164')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      recent &&
      recent.phone_e164 === phone &&
      Date.now() - new Date(recent.created_at).getTime() < RESEND_COOLDOWN_MS
    ) {
      return {
        sent: true,
        phoneLast4: phoneLast4(phone) ?? '',
        enrolled,
      };
    }

    await this.assertSendBudget(user.id, phone);

    const code = generatePhoneCode();
    const codeHash = hashPhoneCode(this.pepper(), phone, code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    await supabase
      .from('phone_mfa_challenges')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('consumed_at', null);

    const { error: insertError } = await supabase
      .from('phone_mfa_challenges')
      .insert({
        user_id: user.id,
        phone_e164: phone,
        code_hash: codeHash,
        expires_at: expiresAt,
      });
    if (insertError) {
      this.logger.error(
        `Could not store phone challenge for ${user.id}: ${insertError.message}`,
      );
      throw new BadRequestException('Could not send a text right now.');
    }

    try {
      await this.sms.sendVerificationCode(phone, code);
    } catch (error) {
      await supabase
        .from('phone_mfa_challenges')
        .update({ consumed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('code_hash', codeHash);
      throw error;
    }

    return {
      sent: true,
      phoneLast4: phoneLast4(phone) ?? '',
      enrolled,
    };
  }

  async verifyCode(
    firebaseUid: string,
    code: string,
    authTime: number | null,
  ): Promise<{ verified: true; phoneLast4: string }> {
    if (authTime == null) {
      throw new BadRequestException('Sign in again, then request a new code.');
    }
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      throw new BadRequestException('Enter the 6-digit code from the text.');
    }

    const user = await this.loadUser(firebaseUid);
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('phone_mfa_challenges')
      .select('id, phone_e164, code_hash, attempts, expires_at, created_at')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      throw new BadRequestException(
        'That code is wrong or expired. Request a new text.',
      );
    }
    const challenge = data as ChallengeRow;
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Too many tries. Request a new code.');
    }

    await supabase
      .from('phone_mfa_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challenge.id);

    const actual = hashPhoneCode(this.pepper(), challenge.phone_e164, trimmed);
    if (!phoneCodesMatch(challenge.code_hash, actual)) {
      throw new BadRequestException(
        'That code is wrong or expired. Request a new text.',
      );
    }

    if (user.phone_e164 && user.phone_e164 !== challenge.phone_e164) {
      throw new BadRequestException('Request a new code for your saved number.');
    }

    const { error: saveError } = await supabase
      .from('users')
      .update({
        phone_e164: challenge.phone_e164,
        phone_verified_at: now,
      })
      .eq('id', user.id);
    if (saveError) {
      if (saveError.code === '23505') {
        throw new ConflictException(
          'That mobile number is already verified on another account. Each number can only be used once.',
        );
      }
      throw new BadRequestException('Could not save your mobile number.');
    }

    const { error: sessionError } = await supabase
      .from('phone_mfa_sessions')
      .upsert(
        {
          user_id: user.id,
          auth_time: authTime,
          verified_at: now,
        },
        { onConflict: 'user_id,auth_time' },
      );
    if (sessionError) {
      this.logger.error(
        `Could not store phone session for ${user.id}: ${sessionError.message}`,
      );
      throw new BadRequestException('Could not finish verification. Try again.');
    }

    await supabase
      .from('phone_mfa_challenges')
      .update({ consumed_at: now })
      .eq('id', challenge.id);

    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('phone_mfa_sessions')
      .delete()
      .eq('user_id', user.id)
      .lt('verified_at', cutoff);

    this.logger.log(
      `Phone verified for user ${user.id} (${maskPhone(challenge.phone_e164)})`,
    );

    return {
      verified: true,
      phoneLast4: phoneLast4(challenge.phone_e164) ?? '',
    };
  }
}
