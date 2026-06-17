-- Track how an artist gets paid for a song purchase.
--
-- When the artist has an onboarded Stripe Connect account we route a destination
-- charge straight to them ('transferred'). When the artist is NOT onboarded the
-- platform collects the full amount and still owes the artist a manual payout
-- ('pending'); 'paid' marks that the manual payout has been settled.
ALTER TABLE public.song_purchases
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'transferred';

COMMENT ON COLUMN public.song_purchases.payout_status IS
  'transferred = Stripe destination charge paid the artist directly; pending = platform collected the funds and still owes the artist a manual payout; paid = manual payout completed.';

-- Fast lookup of payouts the platform still owes artists.
CREATE INDEX IF NOT EXISTS idx_song_purchases_payout_pending
  ON public.song_purchases (payout_status)
  WHERE payout_status = 'pending';
