'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { browseApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BrowseFeedItem {
  id: string;
  type: 'image' | 'audio';
  fileUrl: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  provider: {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  likeCount: number;
  bookmarkCount: number;
  liked?: boolean;
  bookmarked?: boolean;
}

const PAGE_SIZE = 12;

export default function BrowsePage() {
  const [items, setItems] = useState<BrowseFeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);
  const [reportingItem, setReportingItem] = useState<BrowseFeedItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const [feedSeed] = useState(() => Math.random().toString(36).slice(2));

  const loadPage = useCallback(async (cursor?: string | null, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await browseApi.getFeed({
        limit: PAGE_SIZE,
        cursor: cursor ?? undefined,
        seed: feedSeed,
      });
      const data = res.data as { items: BrowseFeedItem[]; nextCursor: string | null };
      if (append) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load feed:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPage(null, false);
  }, [loadPage]);

  useEffect(() => {
    if (!nextCursor || loadingMore) return;
    const el = scrollSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadPage(nextCursor, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadPage, loadingMore]);

  const handleLike = async (item: BrowseFeedItem) => {
    setLikingId(item.id);
    try {
      const res = await browseApi.toggleLike(item.id);
      const data = res.data as { liked: boolean; likeCount: number };
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, liked: data.liked, likeCount: data.likeCount }
            : i,
        ),
      );
    } catch (e) {
      console.error('Like failed:', e);
    } finally {
      setLikingId(null);
    }
  };

  const handleBookmark = async (item: BrowseFeedItem) => {
    setBookmarkingId(item.id);
    try {
      if (item.bookmarked) {
        await browseApi.removeBookmark(item.id);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, bookmarked: false, bookmarkCount: Math.max(0, i.bookmarkCount - 1) }
              : i,
          ),
        );
      } else {
        await browseApi.addBookmark(item.id);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, bookmarked: true, bookmarkCount: i.bookmarkCount + 1 }
              : i,
          ),
        );
      }
    } catch (e) {
      console.error('Bookmark failed:', e);
    } finally {
      setBookmarkingId(null);
    }
  };

  const handleReportSubmit = async () => {
    if (!reportingItem || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      await browseApi.report(reportingItem.id, reportReason.trim());
      setReportingItem(null);
      setReportReason('');
    } catch (e) {
      console.error('Report failed:', e);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No content in the feed yet.</p>
        <p className="text-sm mt-2">When service providers add portfolio items, they’ll show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Scroll to load more. Like and bookmark to save — no downloads.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/browse/saved">Saved</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-square relative bg-muted">
                {item.type === 'image' ? (
                  <Image
                    src={item.fileUrl}
                    alt={item.title ?? 'Portfolio'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized={item.fileUrl.startsWith('http') && !item.fileUrl.includes('supabase')}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <audio
                      src={item.fileUrl}
                      controls
                      className="w-full max-w-full px-2"
                      preload="metadata"
                    />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <Link
                    href={`/artist/${item.provider.userId}`}
                    className="flex items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-white text-sm hover:bg-black/70"
                  >
                    {item.provider.avatarUrl ? (
                      <Image
                        src={item.provider.avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs">
                        {item.provider.displayName?.[0] ?? '?'}
                      </span>
                    )}
                    <span className="truncate max-w-[120px]">
                      {item.provider.displayName ?? 'Creator'}
                    </span>
                  </Link>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-full bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                      onClick={() => handleLike(item)}
                      disabled={likingId === item.id}
                    >
                      <span className={item.liked ? 'text-red-400' : ''}>
                        {item.liked ? '❤️' : '🤍'}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-full bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                      onClick={() => handleBookmark(item)}
                      disabled={bookmarkingId === item.id}
                    >
                      {item.bookmarked ? '🔖' : '📑'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 min-h-[44px] min-w-[44px] rounded-full bg-black/50 text-white hover:bg-black/70 touch-manipulation"
                      onClick={() => { setReportingItem(item); setReportReason(''); }}
                      aria-label="Report"
                    >
                      🚩
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-3">
                {item.title && (
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                )}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {item.likeCount} like{item.likeCount !== 1 ? 's' : ''}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div ref={scrollSentinelRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      <Dialog open={!!reportingItem} onOpenChange={(open) => !open && setReportingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this content</DialogTitle>
            <DialogDescription>
              Tell us why you&apos;re reporting. Reports are reviewed by moderators.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason (required)</Label>
            <Textarea
              id="report-reason"
              placeholder="e.g. Inappropriate, spam, copyright..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportingItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReportSubmit}
              disabled={!reportReason.trim() || reportSubmitting}
            >
              {reportSubmitting ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
