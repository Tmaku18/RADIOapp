import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_PHONE_MFA_KEY } from '../decorators/skip-phone-mfa.decorator';
import type { FirebaseUser } from '../decorators/user.decorator';

@Injectable()
export class PhoneMfaGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PHONE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as FirebaseUser | undefined;
    if (!user?.uid || !user.dbUserId) return true;
    if (user.mfaCheckFailed) return true;
    if (user.mfaSatisfied) return true;

    throw new ForbiddenException({
      message:
        'Enter the text message code to continue. Each account needs its own mobile number.',
      details: { code: 'PHONE_MFA_REQUIRED' },
    });
  }
}
