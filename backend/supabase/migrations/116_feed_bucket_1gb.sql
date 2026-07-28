-- Raise the feed bucket ceiling to 1GB.
-- 200MB only covered ~1080p clips; a 3 minute 4K phone recording is 500MB+,
-- so short videos were being rejected on size alone.
UPDATE storage.buckets
SET file_size_limit = 1073741824 -- 1GB
WHERE id = 'feed';
