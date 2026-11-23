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
      };
      let user: UserRow | null = null;
      let userLookupError: { message: string } | null = null;
      try {
        const result = await withDeadline<{
          data: UserRow | null;
          error: { message: string } | null;
        }>('users lookup', 5000, async () => {
          const { data, error } = await supabase
            .from('users')
            .select('id, role, is_banned, ban_reason')
            .eq('firebase_uid', decodedToken.uid)
            .maybeSingle();
          return {
            data: (data as UserRow | null) ?? null,
            error: error ? { message: error.message } : null,
          };
        });
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
            .select('id, role, is_banned, ban_reason')
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

      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        dbRole: user?.role ?? null,
        dbUserId: user?.id ?? null,
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
}
