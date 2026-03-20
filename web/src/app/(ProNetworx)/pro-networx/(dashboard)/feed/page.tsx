'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const FEED_PAGE_SIZE = 10;

function shouldUnoptimizeImage(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

export default function ProNetworxFeedPage() {
  const { profile } = useAuth();
  const isCatalyst = profile?.role === 'service_provider' || profile?.role === 'admin';
  const [feedPosts, setFeedPosts] = useState<DiscoverFeedPost[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const feedSentinelRef = useRef<HTMLDivElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadFeed = useCallback(async (append: boolean, cursor?: string | null) => {
    if (append) setFeedLoadingMore(true);
    else setFeedLoading(true);
    try {
      const res = await discoveryApi.listFeed({
        limit: FEED_PAGE_SIZE,
        cursor: cursor || undefined,
      });
      const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
      if (append) {
        setFeedPosts((prev) => [...prev, ...data.items]);
      } else {
        setFeedPosts(data.items);
      }
      setFeedNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load feed:', e);
      if (!append) setFeedPosts([]);
    } finally {
      setFeedLoading(false);
      setFeedLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  useEffect(() => {
    if (!feedNextCursor || feedLoadingMore) return;
    const el = feedSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadFeed(true, feedNextCursor);
      },
      { rootMargin: '400px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [feedNextCursor, feedLoadingMore, loadFeed]);

  const handleCreatePost = async () => {
    if (!uploadFile) {
      setUploadError('Choose an image.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await discoveryApi.createFeedPost(uploadFile, uploadCaption || undefined);
      const created = res.data as DiscoverFeedPost;
      setFeedPosts((prev) => [created, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCaption('');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
        <h1 className="text-lg font-semibold text-foreground">Discover</h1>
        {isCatalyst && (
          <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) setUploadError(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary text-primary-foreground">Add post</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New post</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Image</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="mt-1"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <Label>Caption (optional)</Label>
                  <Textarea
                    placeholder="Say something..."
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                <Button onClick={handleCreatePost} disabled={uploading}>
                  {uploading ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* TikTok-style vertical scroll: one post per viewport, scroll-snap */}
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory">
        {feedLoading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          </div>
        ) : feedPosts.length === 0 ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-muted-foreground">No posts yet. Catalysts share their work here.</p>
            <Button variant="outline" asChild>
              <Link href="/pro-networx/directory">Browse directory</Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feedPosts.map((post) => (
              <article
                key={post.id}
                className="min-h-[100vh] min-h-[100dvh] snap-start snap-always flex flex-col bg-background"
              >
                <Link
                  href={`/pro-networx/u/${post.authorUserId}`}
                  className="flex items-center gap-3 p-3 shrink-0 border-b border-border/60"
                >
                  {post.authorAvatarUrl ? (
                    <Image
                      src={post.authorAvatarUrl}
                      alt={post.authorDisplayName ?? 'Avatar'}
                      width={44}
                      height={44}
                      className="rounded-full object-cover"
                      unoptimized={shouldUnoptimizeImage(post.authorAvatarUrl)}
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-xl">🛠️</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{post.authorDisplayName || 'Catalyst'}</p>
                    {post.authorHeadline && (
                      <p className="text-xs text-muted-foreground truncate">{post.authorHeadline}</p>
                    )}
                  </div>
                </Link>
                <div className="relative flex-1 min-h-0 w-full bg-muted">
                  <Image
                    src={post.imageUrl}
                    alt={post.caption || 'Post'}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    unoptimized={shouldUnoptimizeImage(post.imageUrl)}
                  />
                </div>
                <div className="p-4 shrink-0 space-y-1">
                  {post.caption && (
                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">{post.caption}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </p>
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <Link href={`/pro-networx/u/${post.authorUserId}`}>View profile</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div ref={feedSentinelRef} className="h-20" />
        {feedLoadingMore && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
