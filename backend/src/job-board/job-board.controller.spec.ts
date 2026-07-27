import { JobBoardController } from './job-board.controller';
import { createSupabaseMock } from '../test-utils/supabase-mock';
import { getSupabaseClient } from '../config/supabase.config';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

describe('JobBoardController', () => {
  it('lists open requests for listeners', async () => {
    const jobBoard = {
      listRequests: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const proNetworkSubscription = { getAccess: jest.fn() };
    const controller = new JobBoardController(
      jobBoard as any,
      proNetworkSubscription as any,
    );
    const supabase = createSupabaseMock();
    supabase.__builder.single.mockResolvedValue({
      data: { id: 'user-1', role: 'listener' },
      error: null,
    });
    (getSupabaseClient as jest.Mock).mockReturnValue(supabase);

    await controller.listRequests({ uid: 'firebase-1' } as any);

    expect(jobBoard.listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open', mine: false }),
    );
  });
});
