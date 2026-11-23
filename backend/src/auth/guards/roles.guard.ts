import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { getSupabaseClient } from '../../config/supabase.config';
import { ConfigService } from '@nestjs/config';

/** Role hierarchy: listener ← artist ← service_provider (producer). Upload/artist gates also include dj + musician. */
function roleSatisfies(
  userRole: string,
  requiredRole: string,
  extraRoles: string[] = [],
): boolean {
  const held = new Set([userRole, ...extraRoles]);
  const has = (role: string) => held.has(role);
  if (requiredRole === 'admin') return has('admin');
  if (requiredRole === 'service_provider')
    return has('service_provider') || has('admin');
  if (requiredRole === 'artist')
    return (
      has('artist') ||
      has('service_provider') ||
      has('admin') ||
      has('dj') ||
      has('musician')
    );
  if (requiredRole === 'dj') return has('dj') || has('admin');
  if (requiredRole === 'musician') return has('musician') || has('admin');
  if (requiredRole === 'listener')
    return (
      has('listener') ||
      has('artist') ||
      has('service_provider') ||
      has('admin') ||
      has('dj') ||
      has('musician')
    );
  return has(requiredRole);
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly roleCache = new Map<
    string,
    { role: string; extra: string[]; at: number }
  >();

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

    // Brand-new Google/Apple accounts have no profile until they finish setup.
    return null;
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
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );
      return !!isPublic;
    }

    let userRole: string | null = user.dbRole ?? null;
    let extraRoles: string[] = [];
    const cached = this.roleCache.get(user.uid);
    if (cached && Date.now() - cached.at < 60_000) {
      userRole = cached.role;
      extraRoles = cached.extra;
    } else {
    const supabase = getSupabaseClient();
    let profileRes = await supabase
      .from('users')
      .select('role, user_roles')
      .eq('firebase_uid', user.uid)
      .single();
    if (
      profileRes.error &&
      `${profileRes.error.message ?? ''}`.toLowerCase().includes('user_roles')
    ) {
      profileRes = await supabase
        .from('users')
        .select('role')
        .eq('firebase_uid', user.uid)
        .single();
    }
    const { data, error } = profileRes;
    extraRoles = Array.isArray(data?.user_roles) ? data.user_roles : [];

    if (!userRole) {
      userRole = data?.role ?? null;
      if (!userRole && !error) {
        userRole = await this.ensureUserProfile(user.uid, user.email);
      }
      if (!userRole && error) {
        const missingProfile =
          error.code === 'PGRST116' ||
          `${error.message ?? ''}`.toLowerCase().includes('0 rows');
        if (!missingProfile) {
          const email = (user.email ?? '').trim().toLowerCase();
          userRole = this.getAdminEmails().includes(email)
            ? 'admin'
            : 'listener';
        }
      }
    }

    if (!userRole) {
      throw new ForbiddenException('Account profile not found');
    }
    this.roleCache.set(user.uid, {
      role: userRole,
      extra: extraRoles,
      at: Date.now(),
    });
    }

    const allowed = requiredRoles.some((required) =>
      roleSatisfies(userRole, required, extraRoles),
    );
    if (!allowed) {
      throw new ForbiddenException(
        `Role "${userRole}" does not have access to this resource`,
      );
    }
    return true;
  }
}
