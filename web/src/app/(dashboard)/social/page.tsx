'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, RefreshCcw } from 'lucide-react';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FeedReels } from '@/components/pro-networx/FeedReels';

const PAGE_SIZE = 12;

export default function SocialFeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<DiscoverFeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialLoadStartedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const res = await discoveryApi.listFeed({
        limit: PAGE_SIZE,
        scope: 'all',
      });
      setPosts(res.data.items ?? []);
      setCursor(res.data.nextCursor ?? null);
      setHasMore(Boolean(res.data.nextCursor));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursor || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await discoveryApi.listFeed({
        limit: PAGE_SIZE,
        cursor,
        scope: 'all',
      });
      const next = res.data.items ?? [];
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.data.nextCursor ?? null);
      setHasMore(Boolean(res.data.nextCursor));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loadingMore]);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;
    void loadInitial();
  }, [loadInitial]);

  const handlePostUpdate = useCallback((next: DiscoverFeedPost) => {
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);

  const handlePostRemoved = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handleClose = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/listen');
  }, [router]);

  return (
    <FeedReels
      title="Feed"
      posts={posts}
      loading={loadingInitial}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onLoadMore={() => void loadMore()}
      onPostChange={handlePostUpdate}
      onPostRemoved={handlePostRemoved}
      onClose={handleClose}
      error={error}
      topRight={
        <>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Refresh feed"
            title="Refresh feed"
            onClick={() => void loadInitial()}
            disabled={loadingInitial}
            className="h-10 w-10 rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65 hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          <Button
            asChild
            size="sm"
            className="rounded-full bg-primary text-primary-foreground hover:opacity-90"
          >
            <Link href="/pro-networx/home" className="flex items-center">
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Post
            </Link>
          </Button>
        </>
      }
      empty={
        <>
          <p className="text-white/70">
            No posts yet. Be the first to share your work on Pro-Networx.
          </p>
          <Button asChild>
            <Link href="/pro-networx/home">Open Pro-Networx</Link>
          </Button>
        </>
      }
    />
  );
}
