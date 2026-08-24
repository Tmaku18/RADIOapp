import { promoteListenerToArtist } from './promote-listener';
import { getSupabaseClient } from '../config/supabase.config';
import { ensureWelcomePlacements } from '../credits/welcome-placements';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../credits/welcome-placements', () => ({
  ensureWelcomePlacements: jest.fn().mockResolvedValue(undefined),
  SIGNUP_WELCOME_PLACEMENTS: 10,
}));

describe('promoteListenerToArtist', () => {
  const from = jest.fn();
  const select = jest.fn();
  const eq = jest.fn();
  const maybeSingle = jest.fn();
  const update = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    from.mockImplementation(() => {
      return {
        select: select.mockReturnValue({
          eq: eq.mockReturnValue({ maybeSingle }),
        }),
        update: update.mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from });
  });

  it('promotes a listener and seeds welcome placements', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'u1', role: 'listener' },
      error: null,
    });
    await promoteListenerToArtist('u1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'artist' }),
    );
    expect(ensureWelcomePlacements).toHaveBeenCalledWith('u1');
  });

  it('is a no-op for existing artists', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'u1', role: 'artist' },
      error: null,
    });
    await promoteListenerToArtist('u1');
    expect(update).not.toHaveBeenCalled();
    expect(ensureWelcomePlacements).not.toHaveBeenCalled();
  });
});
