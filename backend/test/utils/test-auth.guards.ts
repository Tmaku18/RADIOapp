import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator';

function roleSatisfies(userRole: string, requiredRole: string): boolean {
  if (requiredRole === 'admin') return userRole === 'admin';
  if (requiredRole === 'service_provider')
    return userRole === 'service_provider' || userRole === 'admin';
  if (requiredRole === 'artist')
    return [
      'artist',
      'service_provider',
      'admin',
      'dj',
      'musician',
    ].includes(userRole);
  if (requiredRole === 'dj') return userRole === 'dj' || userRole === 'admin';
  if (requiredRole === 'musician')
    return userRole === 'musician' || userRole === 'admin';
  if (requiredRole === 'listener')
    return [
      'listener',
      'artist',
      'service_provider',
      'admin',
      'dj',
      'musician',
    ].includes(userRole);
  return userRole === requiredRole;
}

/**
 * Test double for FirebaseAuthGuard.
 * - Honors @Public()
 * - Requires `x-test-uid` header (no Firebase)
 * - Sets `request.user = { uid, email }`
 */
@Injectable()
export class TestFirebaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const uid = (req.headers['x-test-uid'] as string | undefined)?.trim();
    if (!uid) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }
    const email =
      (req.headers['x-test-email'] as string | undefined)?.trim() ||
      `${uid}@test.local`;
    req.user = { uid, email };
    return true;
  }
}

/**
 * Test double for RolesGuard — uses `x-test-role` instead of Supabase.
 */
@Injectable()
export class TestRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const role =
      (req.headers['x-test-role'] as string | undefined)?.trim() || 'listener';
    const ok = requiredRoles.some((r) => roleSatisfies(role, r));
    if (!ok) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
