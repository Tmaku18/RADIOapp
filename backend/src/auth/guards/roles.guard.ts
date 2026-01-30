import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getSupabaseClient } from '../../config/supabase.config';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
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

    const role = (data as { role: string }).role;
    return requiredRoles.includes(role);
  }
}
