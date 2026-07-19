'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FeedPostCard } from '@/components/pro-networx/FeedPostCard';

const PAGE_SIZE = 12;

export default function LikedPostsPage() {
  const [posts, setPosts] = useState<DiscoverFeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    try {
      const res = await discoveryApi.listLiked({ limit: PAGE_SIZE });
      setPosts(res.data.items ?? []);
      setCursor(res.data.nextCursor ?? null);
      setHasMore(Boolean(res.data.nextCursor));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load liked posts');
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !cursor || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await discoveryApi.listLiked({ limit: PAGE_SIZE, cursor });
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
    if (startedRef.current) return;
    startedRef.current = true;
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const handlePostUpdate = useCallback((next: DiscoverFeedPost) => {
    if (next.likedByMe === false) {
      setPosts((prev) => prev.filter((p) => p.id !== next.id));
      return;
    }
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/profile" aria-label="Back to profile">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Liked</h1>
          <p className="text-sm text-muted-foreground">Posts you&apos;ve liked across the feed.</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loadingInitial ? (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-8 pb-8 text-center">
            <p className="text-muted-foreground">
              No liked posts yet. Tap the heart on a post to like it.
            </p>
            <Button asChild>
              <Link href="/social">Browse the feed</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPostCard key={post.id} post={post} onChange={handlePostUpdate} />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
