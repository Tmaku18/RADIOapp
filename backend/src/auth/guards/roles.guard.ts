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
  if (requiredRole === 'service_provider')
    return userRole === 'service_provider' || userRole === 'admin';
  if (requiredRole === 'artist')
    return ['artist', 'service_provider', 'admin'].includes(userRole);
  if (requiredRole === 'listener')
    return ['listener', 'artist', 'service_provider', 'admin'].includes(
      userRole,
    );
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
    const adminEmails = this.getAdminEmails();
    const isAdminEmail = normalizedEmail
      ? adminEmails.includes(normalizedEmail)
      : false;
    const defaultRole = isAdminEmail ? 'admin' : 'listener';
    const supabase = getSupabaseClient();

    const { data: existingByUid, error: existingByUidError } = await supabase
      .from('users')
      .select('role, email')
      .eq('firebase_uid', firebaseUid)
      .single();
    if (existingByUidError) {
      return null;
    }

    if (existingByUid) {
      let nextRole = existingByUid.role;
      if (isAdminEmail && existingByUid.role !== 'admin') {
        nextRole = 'admin';
      }

      const updatePayload: { role?: string; email?: string } = {};
      if (nextRole !== existingByUid.role) {
        updatePayload.role = nextRole;
      }
      if (normalizedEmail && existingByUid.email !== normalizedEmail) {
        updatePayload.email = normalizedEmail;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from('users')
          .update(updatePayload)
          .eq('firebase_uid', firebaseUid);
      }
      return nextRole;
    }

    if (normalizedEmail) {
      const { data: existingByEmail, error: existingByEmailError } = await supabase
        .from('users')
        .select('role')
        .eq('email', normalizedEmail)
        .single();
      if (existingByEmailError) {
        return null;
      }

      if (existingByEmail) {
        const roleToKeep =
          isAdminEmail && existingByEmail.role !== 'admin'
            ? 'admin'
            : existingByEmail.role;
        await supabase
          .from('users')
          .update({
            firebase_uid: firebaseUid,
            role: roleToKeep,
          })
          .eq('email', normalizedEmail);
        return roleToKeep;
      }
    }

    if (!normalizedEmail) return null;

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
        if (existing?.role) return existing.role;
        if (normalizedEmail) {
          const { data: byEmail } = await supabase
            .from('users')
            .select('role')
            .eq('email', normalizedEmail)
            .single();
          return byEmail?.role ?? null;
        }
        return null;
      }
      return null;
    }

    return data?.role ?? defaultRole;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

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
    if (!userRole && !error) {
      userRole = await this.ensureUserProfile(user.uid, user.email);
    }
    if (!userRole && error) {
      // DB temporarily unavailable: fall back to email allowlist, otherwise safest base role.
      const email = (user.email ?? '').trim().toLowerCase();
      userRole = this.getAdminEmails().includes(email) ? 'admin' : 'listener';
    }

    if (!userRole) {
      throw new ForbiddenException('Account profile not found');
    }

    const allowed = requiredRoles.some((required) =>
      roleSatisfies(userRole, required),
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Role "${userRole}" does not have access to this resource`,
      );
    }
    return true;
  }
}
