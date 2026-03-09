import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getSupabaseClient } from '../../config/supabase.config';

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
  constructor(private reflector: Reflector) {}

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

    if (error || !data) {
      return false;
    }

    return requiredRoles.some((required) => roleSatisfies(data.role, required));
  }
}
