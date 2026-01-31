import { AuthController } from './auth.controller';

describe('AuthController', () => {
  it('returns Firebase user identity details', () => {
    const controller = new AuthController();
    const result = controller.verify({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: true,
    } as any);

    expect(result).toEqual({
      uid: 'uid-1',
      email: 'user@example.com',
      emailVerified: true,
    });
  });
});
