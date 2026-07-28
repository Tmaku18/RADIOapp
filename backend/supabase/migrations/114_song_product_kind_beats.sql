-- Beats marketplace: songs can be product_kind = song | beat.
-- Beats are sold with full pre-purchase listening; songs stay sample-gated.

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS product_kind text NOT NULL DEFAULT 'song';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'songs_product_kind_check'
  ) THEN
    ALTER TABLE songs
      ADD CONSTRAINT songs_product_kind_check
      CHECK (product_kind IN ('song', 'beat'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_songs_beats_marketplace
  ON songs (product_kind, is_for_sale, status, created_at DESC)
  WHERE product_kind = 'beat';

COMMENT ON COLUMN songs.product_kind IS
  'song = radio/sample-gated track; beat = marketplace beat with full listen-before-buy preview';
