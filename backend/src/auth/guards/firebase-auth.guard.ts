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
    if (!normalizedEmail) return;
    const supabase = getSupabaseClient();

    const adminEmails = this.getAdminEmails();
    const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'listener';

    const { error } = await supabase.from('users').insert({
      firebase_uid: firebaseUid,
      email: normalizedEmail,
      role,
    });
    if (error && error.code !== '23505') {
      this.logger.warn(
        `Failed to auto-provision user profile for ${firebaseUid}: ${error.message}`,
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const auth = getFirebaseAuth();
      const decodedToken = await auth.verifyIdToken(token);
      
      // Check if user is banned in database
      const supabase = getSupabaseClient();
      const { data: user } = await supabase
        .from('users')
        .select('id, is_banned, ban_reason')
        .eq('firebase_uid', decodedToken.uid)
        .single();

      if (!user) {
        await this.ensureUserProfile(decodedToken.uid, decodedToken.email);
      }

      if (user?.is_banned) {
        this.logger.warn(`Banned user attempted access: ${decodedToken.uid}`);
        throw new ForbiddenException(
          user.ban_reason 
            ? `Account suspended: ${user.ban_reason}` 
            : 'Your account has been suspended'
        );
      }

      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
