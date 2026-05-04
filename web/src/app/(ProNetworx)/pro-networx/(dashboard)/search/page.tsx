'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search as SearchIcon, X } from 'lucide-react';
import {
  discoveryApi,
  type DiscoverFeedPost,
  type DiscoverFeedSearchResult,
} from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 30;

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export default function ProNetworxSearchPage() {
  const [tiles, setTiles] = useState<DiscoverFeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoverFeedSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const loadExplore = useCallback(
    async (append: boolean, cursor?: string | null) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await discoveryApi.exploreStream({
          cursor: cursor ?? null,
          limit: PAGE_SIZE,
        });
        const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
        setTiles((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
      } catch (e) {
        console.error('Failed to load explore tiles:', e);
        if (!append) setTiles([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadExplore(false);
  }, [loadExplore]);

  useEffect(() => {
    if (!nextCursor || loadingMore || results) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadExplore(true, nextCursor);
      },
      { rootMargin: '600px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, results, loadExplore]);

  // Debounced search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await discoveryApi.searchFeed(trimmed);
        setResults(res.data);
      } catch {
        setResults({ people: [], posts: [] });
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creators, headlines, captions…"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {results ? (
        <div className="space-y-6">
          {searching && (
            <p className="text-sm text-muted-foreground">Searching…</p>
          )}
          {results.people.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                People
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.people.map((person) => (
                  <Link
                    key={person.userId}
                    href={`/pro-networx/u/${person.userId}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    {person.avatarUrl ? (
                      <Image
                        src={person.avatarUrl}
                        alt={person.displayName ?? 'Avatar'}
                        width={44}
                        height={44}
                        className="rounded-full object-cover"
                        unoptimized={shouldUnoptimize(person.avatarUrl)}
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center">
                        🎨
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {person.displayName || 'Creator'}
                      </p>
                      {person.headline && (
                        <p className="text-xs text-muted-foreground truncate">
                          {person.headline}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {results.posts.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Posts
              </h2>
              <ExploreGrid posts={results.posts} />
            </section>
          )}
          {!searching && results.people.length === 0 && results.posts.length === 0 && (
            <p className="text-sm text-muted-foreground">No matches.</p>
          )}
          <Button variant="outline" onClick={() => setQuery('')}>
            Back to Explore
          </Button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : tiles.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Nothing to explore yet. Be the first to post.
        </div>
      ) : (
        <>
          <ExploreGrid posts={tiles} />
          <div ref={sentinelRef} className="h-12" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExploreGrid({ posts }: { posts: DiscoverFeedPost[] }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/pro-networx/explore/${post.id}`}
          className="relative aspect-square overflow-hidden rounded-md bg-muted group"
        >
          {post.mediaType === 'video' ? (
            <video
              src={post.imageUrl}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <Image
              src={post.imageUrl}
              alt={post.caption || 'Post'}
              fill
              sizes="(max-width: 640px) 33vw, 200px"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
              unoptimized={shouldUnoptimize(post.imageUrl)}
            />
          )}
        </Link>
      ))}
    </div>
  );
}
