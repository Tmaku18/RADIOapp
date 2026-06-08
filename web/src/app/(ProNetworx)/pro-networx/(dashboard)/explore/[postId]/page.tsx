'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FeedPostCard } from '@/components/pro-networx/FeedPostCard';

const PAGE_SIZE = 8;

export default function ProNetworxExploreDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = use(params);
  const [posts, setPosts] = useState<DiscoverFeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discoveryApi.exploreStream({
        anchorPostId: postId,
        limit: PAGE_SIZE,
      });
      const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
      setPosts(data.items);
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load explore detail:', e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const loadMore = useCallback(async (cursor: string) => {
    setLoadingMore(true);
    try {
      const res = await discoveryApi.exploreStream({
        cursor,
        limit: PAGE_SIZE,
      });
      const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
      setPosts((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!nextCursor || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore(nextCursor);
      },
      { rootMargin: '600px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, loadMore]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/pro-networx/search" className="inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Explore
        </Link>
      </Button>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Post not found.
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, idx) => (
            <FeedPostCard
              key={post.id}
              post={post}
              variant={idx === 0 ? 'detail' : 'feed'}
              onChange={(next) =>
                setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
              }
              onDeleted={(deletedId) =>
                setPosts((prev) => prev.filter((p) => p.id !== deletedId))
              }
            />
          ))}
          <div ref={sentinelRef} className="h-12" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
