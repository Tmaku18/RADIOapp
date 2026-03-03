'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { artistLiveApi } from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

type LiveStatus = {
  isLive: boolean;
  sessionId?: string;
  title?: string | null;
  status?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string | null;
};

export function GoLiveSheet({ open, onOpenChange, artistId }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !artistId) return;
    setError(null);
    setLoading(true);
    artistLiveApi
      .getStatus(artistId)
      .then((res) => {
        const data = res.data as { live?: boolean; session?: { id?: string; title?: string | null; status?: string } | null };
        const session = data?.session;
        setStatus({
          isLive: !!data?.live && !!session,
          sessionId: session?.id,
          title: session?.title,
          status: session?.status,
        });
        if (session?.title) setTitle(session.title ?? '');
      })
      .catch(() => setStatus({ isLive: false }))
      .finally(() => setLoading(false));
  }, [open, artistId]);

  const handleStart = async () => {
    if (!artistId) return;
    setError(null);
    setStartLoading(true);
    try {
      await artistLiveApi.start({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      });
      setStatus({ isLive: true, title: title.trim() || null });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to start stream');
      setError(msg);
    } finally {
      setStartLoading(false);
    }
  };

  const handleStop = async () => {
    setError(null);
    setStopLoading(true);
    try {
      await artistLiveApi.stop();
      setStatus({ isLive: false });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to stop stream');
      setError(msg);
    } finally {
      setStopLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Stream Manager</SheetTitle>
          <SheetDescription>
            Edit stream info and start or stop your livestream. Set up your stream key in Live services first.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 py-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            </div>
          ) : status?.isLive ? (
            <div className="space-y-4">
              <Alert className="border-green-600/50 bg-green-500/10">
                <AlertDescription className="text-green-800 dark:text-green-200">
                  You&apos;re live. Viewers can watch from the Live page and when your track is on air.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Title: {status.title || 'Untitled stream'}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="destructive"
                  onClick={handleStop}
                  disabled={stopLoading}
                >
                  {stopLoading ? 'Stopping...' : 'End stream'}
                </Button>
                {artistId && (
                  <Button variant="outline" asChild>
                    <Link href={`/watch/${artistId}`}>Open watch page</Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="stream-title">Stream title</Label>
                <Input
                  id="stream-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Studio session"
                  maxLength={140}
                />
                <p className="text-xs text-muted-foreground">Max 140 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream-description">Description</Label>
                <Textarea
                  id="stream-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this stream about?"
                  rows={3}
                  maxLength={1000}
                  className="resize-y"
                />
                <p className="text-xs text-muted-foreground">Max 1000 characters</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stream-category">Category</Label>
                <Input
                  id="stream-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Music, Talk"
                  maxLength={64}
                />
              </div>
              <SheetFooter>
                <Button onClick={handleStart} disabled={startLoading}>
                  {startLoading ? 'Starting...' : 'Start stream'}
                </Button>
              </SheetFooter>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4 mt-auto">
          <Link href="/artist/live-services" className="underline hover:text-foreground">
            Live services
          </Link>
          {' — '}
          Manage stream keys and encoder setup.
        </p>
      </SheetContent>
    </Sheet>
  );
}
