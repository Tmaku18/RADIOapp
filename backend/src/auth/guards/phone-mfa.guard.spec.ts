import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PhoneMfaGuard } from './phone-mfa.guard';

const createContext = (request: Record<string, unknown>, flags: {
  isPublic?: boolean;
  skip?: boolean;
}) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    flags,
  }) as any;

describe('PhoneMfaGuard', () => {
  const guardFor = (flags: { isPublic?: boolean; skip?: boolean }) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === 'isPublic') return flags.isPublic === true;
        if (key === 'skipPhoneMfa') return flags.skip === true;
        return false;
      }),
    } as unknown as Reflector;
    return new PhoneMfaGuard(reflector);
  };

  it('allows public routes and routes that finish verification', () => {
    expect(
      guardFor({ isPublic: true }).canActivate(createContext({}, { isPublic: true })),
    ).toBe(true);
    expect(
      guardFor({ skip: true }).canActivate(
        createContext({ user: { uid: 'u', dbUserId: 'db', mfaSatisfied: false } }, {}),
      ),
    ).toBe(true);
  });

  it('blocks a signed-in account until the text code is confirmed', () => {
    const guard = guardFor({});
    expect(() =>
      guard.canActivate(
        createContext(
          { user: { uid: 'u', dbUserId: 'db', mfaSatisfied: false } },
          {},
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows the request after this sign-in has been confirmed', () => {
    const guard = guardFor({});
    expect(
      guard.canActivate(
        createContext(
          { user: { uid: 'u', dbUserId: 'db', mfaSatisfied: true } },
          {},
        ),
      ),
    ).toBe(true);
  });
});
