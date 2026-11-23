import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('returns Firebase user identity details', () => {
    const controller = new AuthController({} as any);
    const result = controller.verify({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: true,
    } as any);

    expect(result).toEqual({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: true,
      role: null,
      phoneVerified: false,
      phoneLast4: null,
      mfaSatisfied: false,
    });
  });
});
