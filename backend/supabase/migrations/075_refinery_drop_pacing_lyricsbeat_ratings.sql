-- The Refinery: retire the "pacing / timing" and "lyrics match the beat"
-- rating questions. New reviews no longer collect these, so the columns must
-- be nullable. We keep the columns (and any historical data) for backwards
-- compatibility instead of dropping them.

alter table public.refinery_reviews
  alter column pacing_rating drop not null;

alter table public.refinery_reviews
  alter column lyrics_beat_match_rating drop not null;
