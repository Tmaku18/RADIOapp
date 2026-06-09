'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';

const FEED_PAGE_SIZE = 10;

function shouldUnoptimizeImage(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export default function HomeFeedPage() {
  const [feedPosts, setFeedPosts] = useState<DiscoverFeedPost[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const feedSentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (append: boolean, cursor?: string | null) => {
    if (append) setFeedLoadingMore(true);
    else setFeedLoading(true);
    try {
      const res = await discoveryApi.listFeed({
        limit: FEED_PAGE_SIZE,
        cursor: cursor || undefined,
        scope: 'following',
      });
      const data = res.data;
      setFeedPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setFeedNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load home feed:', e);
      if (!append) setFeedPosts([]);
    } finally {
      setFeedLoading(false);
      setFeedLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  useEffect(() => {
    if (!feedNextCursor || feedLoadingMore) return;
    const el = feedSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadFeed(true, feedNextCursor);
      },
      { rootMargin: '400px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [feedNextCursor, feedLoadingMore, loadFeed]);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Home</h1>
        <p className="text-sm text-muted-foreground">
          Posts from creators you follow.
        </p>
      </div>

      {feedLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : feedPosts.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Your home feed is empty. Follow creators in Search to see their posts here.
        </div>
      ) : (
        <div className="space-y-6">
          {feedPosts.map((post) => (
            <article key={post.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 p-3 border-b border-border">
                {post.authorAvatarUrl ? (
                  <Image
                    src={post.authorAvatarUrl}
                    alt={post.authorDisplayName ?? 'Avatar'}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                    unoptimized={shouldUnoptimizeImage(post.authorAvatarUrl)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted" />
                )}
                <div className="min-w-0">
                  <Link href={`/u/${post.authorUserId}`} className="font-medium hover:underline">
                    {post.authorDisplayName || 'Creator'}
                  </Link>
                  {post.authorHeadline && (
                    <p className="text-xs text-muted-foreground truncate">{post.authorHeadline}</p>
                  )}
                </div>
              </div>
              <div className="relative aspect-square bg-muted">
                {post.mediaType === 'video' ? (
                  <video src={post.imageUrl} controls playsInline className="w-full h-full object-cover" />
                ) : (
                  <Image
                    src={post.imageUrl}
                    alt={post.caption || 'Post'}
                    fill
                    sizes="640px"
                    className="object-cover"
                    unoptimized={shouldUnoptimizeImage(post.imageUrl)}
                  />
                )}
              </div>
              {post.caption && (
                <p className="p-3 text-sm text-foreground whitespace-pre-wrap">{post.caption}</p>
              )}
            </article>
          ))}
          <div ref={feedSentinelRef} className="h-8" />
          {feedLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
