import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface FirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  /** Row id from the users table, set by the auth guard so handlers skip a second lookup. */
  dbUserId?: string | null;
  dbRole?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): FirebaseUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
