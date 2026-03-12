import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getSupabaseClient } from '../../config/supabase.config';
import { ConfigService } from '@nestjs/config';

/** Role hierarchy: listener (parent) ← artist (Gem) ← service_provider (Catalyst). User satisfies required role if their role inherits it. */
function roleSatisfies(userRole: string, requiredRole: string): boolean {
  if (requiredRole === 'admin') return userRole === 'admin';
  if (requiredRole === 'service_provider') return userRole === 'service_provider' || userRole === 'admin';
  if (requiredRole === 'artist') return ['artist', 'service_provider', 'admin'].includes(userRole);
  if (requiredRole === 'listener') return ['listener', 'artist', 'service_provider', 'admin'].includes(userRole);
  return userRole === requiredRole;
}

@Injectable()
export class RolesGuard implements CanActivate {
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
  ): Promise<string | null> {
    const normalizedEmail = email?.trim().toLowerCase() || null;
    if (!normalizedEmail) return null;

    const adminEmails = this.getAdminEmails();
    const defaultRole = adminEmails.includes(normalizedEmail)
      ? 'admin'
      : 'artist';
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('users')
      .insert({
        firebase_uid: firebaseUid,
        email: normalizedEmail,
        role: defaultRole,
      })
      .select('id, role')
      .single();

    if (error) {
      // Handle race where another request created the row first.
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('users')
          .select('role')
          .eq('firebase_uid', firebaseUid)
          .single();
        return existing?.role ?? null;
      }
      return null;
    }

    // Keep role-specific side effects in sync with createUser behavior.
    if (defaultRole === 'artist') {
      await supabase
        .from('credits')
        .insert({ artist_id: (data as any).id, balance: 0 });
    }

    return data?.role ?? defaultRole;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('firebase_uid', user.uid)
      .single();

    let userRole: string | null = data?.role ?? null;
    if (!userRole) {
      userRole = await this.ensureUserProfile(user.uid, user.email);
    }

    if (!userRole) {
      throw new ForbiddenException('Account profile not found');
    }

    const allowed = requiredRoles.some((required) =>
      roleSatisfies(userRole!, required),
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Role "${userRole}" does not have access to this resource`,
      );
    }
    return true;
  }
}
