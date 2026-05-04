'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
import { hasArtistCapability } from '@/lib/roles';
import { FeedPostCard } from '@/components/pro-networx/FeedPostCard';

const FEED_PAGE_SIZE = 12;

export default function ProNetworxHomePage() {
  const { profile } = useAuth();
  const canPost = hasArtistCapability(profile?.role);
  const [posts, setPosts] = useState<DiscoverFeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadFeed = useCallback(async (append: boolean, cursor?: string | null) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await discoveryApi.listFeed({
        limit: FEED_PAGE_SIZE,
        cursor: cursor || undefined,
        scope: 'following',
      });
      const data = res.data as { items: DiscoverFeedPost[]; nextCursor: string | null };
      setPosts((prev) => (append ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch (e) {
      console.error('Failed to load home feed:', e);
      if (!append) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed(false);
  }, [loadFeed]);

  useEffect(() => {
    if (!nextCursor || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadFeed(true, nextCursor);
      },
      { rootMargin: '400px', threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, loadingMore, loadFeed]);

  const handleCreatePost = async () => {
    if (!uploadFile) {
      setUploadError('Choose an image or short video.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await discoveryApi.createFeedPost(uploadFile, uploadCaption || undefined);
      const created = res.data as DiscoverFeedPost;
      setPosts((prev) => [created, ...prev]);
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Home</h1>
          <p className="text-sm text-muted-foreground">
            Posts from creators you follow.
          </p>
        </div>
        {canPost && (
          <Dialog
            open={uploadOpen}
            onOpenChange={(o) => {
              setUploadOpen(o);
              if (!o) setUploadError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary text-primary-foreground">
                New post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share to your network</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Image or short video</Label>
                  <Input
                    type="file"
                    accept="image/*,video/mp4,video/quicktime"
                    className="mt-1"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <Label>Caption (optional)</Label>
                  <Textarea
                    placeholder="Add a caption…"
                    value={uploadCaption}
                    onChange={(e) => setUploadCaption(e.target.value)}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
                {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                <Button onClick={handleCreatePost} disabled={uploading}>
                  {uploading ? 'Posting…' : 'Post'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center space-y-3">
          <p className="text-foreground font-medium">Your home feed is empty</p>
          <p className="text-sm text-muted-foreground">
            Follow creators in Search to see their posts here.
          </p>
          <Button asChild>
            <Link href="/pro-networx/search">Discover creators</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onChange={(next) =>
                setPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)))
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
