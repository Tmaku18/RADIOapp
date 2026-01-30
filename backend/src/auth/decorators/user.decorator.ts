import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface FirebaseUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): FirebaseUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as FirebaseUser;
  },
);
