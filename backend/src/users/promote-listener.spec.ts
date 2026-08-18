import { promoteListenerToArtist } from './promote-listener';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('promoteListenerToArtist', () => {
  const from = jest.fn();
  const select = jest.fn();
  const eq = jest.fn();
  const maybeSingle = jest.fn();
  const update = jest.fn();
  const insert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    from.mockImplementation((table: string) => {
      if (table === 'credits') {
        return { insert: insert.mockResolvedValue({ error: null }) };
      }
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

  it('promotes a listener and seeds credits', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'u1', role: 'listener' },
      error: null,
    });
    await promoteListenerToArtist('u1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'artist' }),
    );
    expect(insert).toHaveBeenCalledWith({ artist_id: 'u1', balance: 0 });
  });

  it('is a no-op for existing artists', async () => {
    maybeSingle.mockResolvedValue({
      data: { id: 'u1', role: 'artist' },
      error: null,
    });
    await promoteListenerToArtist('u1');
    expect(update).not.toHaveBeenCalled();
  });
});
