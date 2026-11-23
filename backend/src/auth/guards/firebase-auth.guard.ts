import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getFirebaseAuth } from '../../config/firebase.config';
import { getSupabaseClient } from '../../config/supabase.config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { phoneLast4 } from '../phone-mfa.util';
import {
  ACCOUNT_DELETION_EXPIRED_MESSAGE,
  ACCOUNT_DELETION_PENDING_MESSAGE,
} from '../../users/account-deletion';

const USER_AUTH_SELECT =
  'id, role, is_banned, ban_reason, deletion_requested_at, deletion_scheduled_for, phone_e164, phone_verified_at';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  private getAdminEmails(): string[] {
    const raw = this.configService.get<string>('ADMIN_EMAILS');
    if (!raw?.trim()) return [];
    return raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  private async ensureUserProfile(
    firebaseUid: string,
    email?: string | null,
  ): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase() || null;
    const supabase = getSupabaseClient();

    const adminEmails = this.getAdminEmails();
    const isAdminEmail = normalizedEmail
      ? adminEmails.includes(normalizedEmail)
      : false;

    const { data: existingByUid } = await supabase
      .from('users')
      .select('role, email')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (existingByUid) {
      const nextRole =
        isAdminEmail && existingByUid.role !== 'admin'
          ? 'admin'
          : existingByUid.role;
      const updatePayload: { role?: string; email?: string } = {};

      if (nextRole !== existingByUid.role) {
        updatePayload.role = nextRole;
      }
      if (normalizedEmail && existingByUid.email !== normalizedEmail) {
        updatePayload.email = normalizedEmail;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('firebase_uid', firebaseUid);
        if (error) {
          this.logger.warn(
            `Failed to sync existing user profile for ${firebaseUid}: ${error.message}`,
          );
        }
      }
      return;
    }

    if (normalizedEmail) {
      const { data: existingByEmail } = await supabase
        .from('users')
        .select('role')
        .eq('email', normalizedEmail)
        .single();

      if (existingByEmail) {
        const roleToKeep =
          isAdminEmail && existingByEmail.role !== 'admin'
            ? 'admin'
            : existingByEmail.role;
        const { error } = await supabase
          .from('users')
          .update({
            firebase_uid: firebaseUid,
            role: roleToKeep,
          })
          .eq('email', normalizedEmail);
        if (error) {
          this.logger.warn(
            `Failed to attach firebase_uid for ${firebaseUid}: ${error.message}`,
          );
        }
        return;
      }
    }

    // No row yet. Leave profile creation to the client so a first Google or
    // Apple sign-in can choose a display name and role instead of becoming
    // a listener automatically.
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const hasBearer =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    // Public reads stay open. A valid token is still attached so signed-in
    // viewers keep personalization (following, hidden authors).
    if (isPublic && !hasBearer) {
      return true;
    }

    if (!hasBearer) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }

    const token = authHeader.substring(7);

    // Hard upper bound on how long a single auth check can take. Without this,
    // a flaky network between the API host and Firebase/Supabase can hang
    // requests for several minutes, exhaust HTTP sockets, and starve unrelated
    // public endpoints (e.g. /api/radio/current).
    const withDeadline = async <T>(
      label: string,
      ms: number,
      run: () => Promise<T>,
    ): Promise<T> => {
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          run(),
          new Promise<T>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`${label} timed out after ${ms}ms`)),
              ms,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    try {
      const auth = getFirebaseAuth();
      const decodedToken = await withDeadline('verifyIdToken', 6000, () =>
        auth.verifyIdToken(token),
      );

      const supabase = getSupabaseClient();
      type UserRow = {
        id: string;
        role: string | null;
        is_banned: boolean | null;
        ban_reason: string | null;
        deletion_requested_at?: string | null;
        deletion_scheduled_for?: string | null;
        phone_e164?: string | null;
        phone_verified_at?: string | null;
      };
      const lookupUser = async (columns: string) =>
        withDeadline<{
          data: UserRow | null;
          error: { message: string } | null;
        }>('users lookup', 5000, async () => {
          const { data, error } = await supabase
            .from('users')
            .select(columns)
            .eq('firebase_uid', decodedToken.uid)
            .maybeSingle();
          return {
            data: (data as UserRow | null) ?? null,
            error: error ? { message: error.message } : null,
          };
        });
      let user: UserRow | null = null;
      let userLookupError: { message: string } | null = null;
      try {
        let result = await lookupUser(USER_AUTH_SELECT);
        if (
          result.error &&
          /phone_e164|phone_verified_at/i.test(result.error.message)
        ) {
          result = await lookupUser(
            'id, role, is_banned, ban_reason, deletion_requested_at, deletion_scheduled_for',
          );
        }
        if (
          result.error &&
          /deletion_requested_at|deletion_scheduled_for/i.test(result.error.message)
        ) {
          result = await lookupUser('id, role, is_banned, ban_reason');
        }
        user = result.data;
        userLookupError = result.error;
      } catch (lookupError) {
        userLookupError = {
          message:
            lookupError instanceof Error ? lookupError.message : 'lookup failed',
        };
      }

      if (userLookupError) {
        this.logger.warn(
          `User lookup failed for ${decodedToken.uid}: ${userLookupError.message}`,
        );
      } else if (!user) {
        // Attach an existing email account. Do not insert a listener row;
        // first-time Google/Apple users finish setup in the app.
        try {
          await withDeadline('ensureUserProfile', 5000, () =>
            this.ensureUserProfile(decodedToken.uid, decodedToken.email),
          );
          const { data: provisioned } = await supabase
            .from('users')
            .select(USER_AUTH_SELECT)
            .eq('firebase_uid', decodedToken.uid)
            .maybeSingle();
          if (provisioned) {
            user = provisioned as UserRow;
          }
        } catch (err) {
          this.logger.warn(
            `ensureUserProfile failed for ${decodedToken.uid}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }

      if (user?.is_banned) {
        this.logger.warn(`Banned user attempted access: ${decodedToken.uid}`);
        throw new ForbiddenException(
          user.ban_reason
            ? `Account suspended: ${user.ban_reason}`
            : 'Your account has been suspended',
        );
      }

      const accountRestored = user
        ? await this.restoreOrBlockScheduledDeletion(
            user,
            decodedToken.auth_time,
          )
        : false;

      const authTime =
        typeof decodedToken.auth_time === 'number' ? decodedToken.auth_time : null;
      const phoneVerified = Boolean(user?.phone_verified_at);
      let mfaSatisfied = false;
      let mfaCheckFailed = false;
      if (phoneVerified && user?.id && authTime != null && !userLookupError) {
        try {
          const session = await withDeadline('mfa session', 4000, async () => {
            const { data, error } = await supabase
              .from('phone_mfa_sessions')
              .select('auth_time')
              .eq('user_id', user.id)
              .eq('auth_time', authTime)
              .maybeSingle();
            if (error) {
              throw new Error(error.message);
            }
            return data;
          });
          mfaSatisfied = Boolean(session);
        } catch (sessionError) {
          mfaCheckFailed = true;
          this.logger.warn(
            `Phone MFA lookup failed for ${decodedToken.uid}: ${
              sessionError instanceof Error
                ? sessionError.message
                : String(sessionError)
            }`,
          );
        }
      }

      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        dbRole: user?.role ?? null,
        dbUserId: user?.id ?? null,
        accountRestored,
        authTime,
        phoneVerified,
        phoneLast4: phoneLast4(user?.phone_e164),
        mfaSatisfied,
        mfaCheckFailed,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * A deletion request signs the current session out. Signing in again before
   * the deadline clears it. The session that requested deletion has an older
   * auth_time, so it cannot immediately undo the request.
   */
  private async restoreOrBlockScheduledDeletion(
    user: {
      id: string;
      deletion_requested_at?: string | null;
      deletion_scheduled_for?: string | null;
    },
    authTimeSec: number | undefined,
  ): Promise<boolean> {
    if (!user.deletion_scheduled_for) return false;

    const scheduledFor = new Date(user.deletion_scheduled_for).getTime();
    const requestedAt = user.deletion_requested_at
      ? new Date(user.deletion_requested_at).getTime()
      : scheduledFor;
    if (!Number.isFinite(scheduledFor) || Date.now() >= scheduledFor) {
      throw new ForbiddenException(ACCOUNT_DELETION_EXPIRED_MESSAGE);
    }

    // auth_time is whole seconds. Allow a couple of seconds so a sign-in in
    // the same second as the request still counts as a restore. The session
    // that requested deletion signed in earlier than that.
    const authTimeMs = (authTimeSec ?? 0) * 1000;
    if (!(authTimeMs + 2000 > requestedAt)) {
      throw new ForbiddenException(ACCOUNT_DELETION_PENDING_MESSAGE);
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('users')
      .update({
        deletion_requested_at: null,
        deletion_scheduled_for: null,
      })
      .eq('id', user.id);
    if (error) {
      this.logger.warn(
        `Failed to restore account ${user.id}: ${error.message}`,
      );
      throw new ForbiddenException(ACCOUNT_DELETION_PENDING_MESSAGE);
    }
    return true;
  }
}
