import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface FirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  /** Row id from the users table, set by the auth guard so handlers skip a second lookup. */
  dbUserId?: string | null;
  dbRole?: string | null;
  /** True when this sign-in cancelled a deletion that was still inside 48 hours. */
  accountRestored?: boolean;
  /** Firebase sign-in time (seconds). A new sign-in requires a new text code. */
  authTime?: number | null;
  phoneVerified?: boolean;
  phoneLast4?: string | null;
  /** True when this sign-in's text code has already been confirmed. */
  mfaSatisfied?: boolean;
  /** True when the session lookup failed and enforcement should fail open. */
  mfaCheckFailed?: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): FirebaseUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
