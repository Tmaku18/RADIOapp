import { UsersController } from './users.controller';

describe('UsersController', () => {
  it('delegates user creation', async () => {
    const usersService = {
      createUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.createUser(
      { uid: 'firebase-uid' } as any,
      { email: 'user@example.com', displayName: 'User', role: 'listener' } as any,
    );

    expect(usersService.createUser).toHaveBeenCalledWith('firebase-uid', {
      email: 'user@example.com',
      displayName: 'User',
      role: 'listener',
    });
    expect(result).toEqual({ id: 'user-1' });
  });

  it('fetches current user', async () => {
    const usersService = {
      getUserByFirebaseUid: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.getCurrentUser({ uid: 'firebase-uid' } as any);

    expect(usersService.getUserByFirebaseUid).toHaveBeenCalledWith('firebase-uid');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('updates current user', async () => {
    const usersService = {
      updateUser: jest.fn().mockResolvedValue({ id: 'user-1', displayName: 'Updated' }),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.updateCurrentUser(
      { uid: 'firebase-uid' } as any,
      { displayName: 'Updated' } as any,
    );

    expect(usersService.updateUser).toHaveBeenCalledWith('firebase-uid', { displayName: 'Updated' });
    expect(result).toEqual({ id: 'user-1', displayName: 'Updated' });
  });

  it('upgrades current user to artist', async () => {
    const usersService = {
      upgradeToArtist: jest.fn().mockResolvedValue({ role: 'artist' }),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.upgradeToArtist({ uid: 'firebase-uid' } as any);

    expect(usersService.upgradeToArtist).toHaveBeenCalledWith('firebase-uid');
    expect(result).toEqual({ role: 'artist' });
  });

  it('fetches user by id', async () => {
    const usersService = {
      getUserById: jest.fn().mockResolvedValue({ id: 'user-2' }),
    };
    const controller = new UsersController(usersService as any);

    const result = await controller.getUserById('user-2');

    expect(usersService.getUserById).toHaveBeenCalledWith('user-2');
    expect(result).toEqual({ id: 'user-2' });
  });
});
