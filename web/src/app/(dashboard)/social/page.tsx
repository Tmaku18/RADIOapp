'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ImagePlus, RefreshCcw } from 'lucide-react';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FeedPostCard } from '@/components/pro-networx/FeedPostCard';

const PAGE_SIZE = 12;

export default function SocialFeedPage() {
  const [posts, setPosts] = useState<DiscoverFeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
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
    setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Social</h1>
          <p className="text-sm text-muted-foreground">
            Posts from creatives across Pro-Networx. Like and comment here. To
            share your own work, post from Pro-Networx.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadInitial()}
            disabled={loadingInitial}
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href="/pro-networx/home" className="flex items-center">
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Post on Pro-Networx
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Looking for the swipe-to-like clip experience?
            </p>
            <p className="text-xs text-muted-foreground">
              The 15-second song clips have moved to their own Discover tab.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/social/discover" className="flex items-center">
              Open Discover
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="pt-4 text-sm text-destructive">
            {error}
          </CardContent>
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
              No posts yet. Be the first to share your work on Pro-Networx.
            </p>
            <Button asChild>
              <Link href="/pro-networx/home">Open Pro-Networx</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onChange={handlePostUpdate}
            />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">
              You&apos;ve reached the end. New posts from Pro-Networx will appear
              here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
