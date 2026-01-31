import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { createSupabaseMock } from '../../test-utils/supabase-mock';
import { getSupabaseClient } from '../../config/supabase.config';

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

describe('RolesGuard', () => {
  it('allows when no required roles', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('denies when request user missing', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).resolves.toBe(false);
  });

  it('allows when user role matches', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({ user: { uid: 'firebase-uid' } });

    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    });

    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
