'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { FeedReels } from '@/components/pro-networx/FeedReels';

const FEED_PAGE_SIZE = 10;

export default function ProNetworxFeedPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const isCatalyst = profile?.role === 'service_provider' || profile?.role === 'admin';
  const [feedPosts, setFeedPosts] = useState<DiscoverFeedPost[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCover, setUploadCover] = useState<File | null>(null);
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
        setFeedPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...data.items.filter((p) => !seen.has(p.id))];
        });
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

  const handleLoadMore = useCallback(() => {
    if (!feedNextCursor || feedLoadingMore) return;
    void loadFeed(true, feedNextCursor);
  }, [feedNextCursor, feedLoadingMore, loadFeed]);

  const handlePostChange = useCallback((next: DiscoverFeedPost) => {
    setFeedPosts((prev) => prev.map((p) => (p.id === next.id ? next : p)));
  }, []);

  const handlePostRemoved = useCallback((postId: string) => {
    setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const handleClose = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push('/pro-networx/home');
  }, [router]);

  const handleCreatePost = async () => {
    if (!uploadFile) {
      setUploadError('Choose an image or audio track.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const res = await discoveryApi.createFeedPost(
        uploadFile,
        uploadCaption || undefined,
        uploadFile.type.startsWith('audio/') ? uploadCover : null,
      );
      const created = res.data as DiscoverFeedPost;
      setFeedPosts((prev) => [created, ...prev]);
      setUploadOpen(false);
      setUploadFile(null);
      setUploadCover(null);
      setUploadCaption('');
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <FeedReels
      title="Discover"
      posts={feedPosts}
      loading={feedLoading}
      loadingMore={feedLoadingMore}
      hasMore={Boolean(feedNextCursor)}
      onLoadMore={handleLoadMore}
      onPostChange={handlePostChange}
      onPostRemoved={handlePostRemoved}
      onClose={handleClose}
      topRight={
        isCatalyst ? (
          <Dialog
            open={uploadOpen}
            onOpenChange={(o) => {
              setUploadOpen(o);
              if (!o) setUploadError(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-full bg-primary text-primary-foreground">
                Add post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New post</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Image or audio</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac"
                    className="mt-1"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                {uploadFile?.type.startsWith('audio/') && (
                  <div>
                    <Label>Cover picture (optional)</Label>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="mt-1"
                      onChange={(e) => setUploadCover(e.target.files?.[0] ?? null)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Without a picture your track posts with the Networx Radio logo.
                    </p>
                  </div>
                )}
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
                <div className="grid gap-2">
                  <Button onClick={handleCreatePost} disabled={uploading}>
                    {uploading ? 'Posting...' : 'Post'}
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/discover/create-video">
                      Record synced Discover video
                    </Link>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : null
      }
      empty={
        <>
          <p className="text-white/70">No posts yet. Catalysts share their work here.</p>
          <Button variant="outline" asChild className="text-foreground">
            <Link href="/pro-networx/directory">Browse directory</Link>
          </Button>
        </>
      }
    />
  );
}
