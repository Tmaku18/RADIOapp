import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { createSupabaseMock } from '../../test-utils/supabase-mock';
import { getFirebaseAuth } from '../../config/firebase.config';
import { getSupabaseClient } from '../../config/supabase.config';

jest.mock('../../config/firebase.config', () => ({
  getFirebaseAuth: jest.fn(),
}));

jest.mock('../../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

const createContext = (request: any) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  }) as any;

describe('FirebaseAuthGuard', () => {
  it('allows public routes', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects missing auth header', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks banned users', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);
    const request = { headers: { authorization: 'Bearer token' } };
    const context = createContext(request);

    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-id', is_banned: true, ban_reason: 'Test ban' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);
    (getFirebaseAuth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: 'firebase-uid',
        email: 'test@example.com',
        email_verified: true,
      }),
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches user on valid token', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);
    const request: any = { headers: { authorization: 'Bearer token' } };
    const context = createContext(request);

    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-id', is_banned: false },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);
    (getFirebaseAuth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: 'firebase-uid',
        email: 'test@example.com',
        email_verified: true,
      }),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      uid: 'firebase-uid',
      email: 'test@example.com',
      emailVerified: true,
    });
  });
});
