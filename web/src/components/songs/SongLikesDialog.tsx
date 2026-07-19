'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { songsApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type SongLikeUser = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  likedAt: string;
};

function formatLikedAt(iso: string): string {
  const likedAt = new Date(iso);
  if (!Number.isFinite(likedAt.getTime())) return 'Recently';
  const diffMs = Date.now() - likedAt.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return likedAt.toLocaleDateString();
}

export function SongLikesDialog({
  open,
  onOpenChange,
  songId,
  songTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songId: string | null;
  songTitle?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalLikes, setTotalLikes] = useState(0);
  const [likes, setLikes] = useState<SongLikeUser[]>([]);

  useEffect(() => {
    if (!open || !songId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await songsApi.getLikes(songId, { limit: 200, offset: 0 });
        if (cancelled) return;
        setTotalLikes(res.data?.totalLikes ?? 0);
        setLikes(Array.isArray(res.data?.likes) ? res.data.likes : []);
      } catch (e) {
        if (cancelled) return;
        setError('Could not load likes right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, songId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Likes {songTitle ? `for "${songTitle}"` : ''} ({totalLikes})
          </DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Loading likes...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && likes.length === 0 && (
          <p className="text-sm text-muted-foreground">No likes yet.</p>
        )}
        {!loading && !error && likes.length > 0 && (
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {likes.map((like) => (
              <div
                key={`${like.userId}:${like.likedAt}`}
                className="flex items-center justify-between gap-3"
              >
                <Link
                  href={`/artist/${like.userId}`}
                  className="flex items-center gap-3 min-w-0 hover:opacity-90"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={like.avatarUrl ?? undefined} />
                    <AvatarFallback>
                      {(like.displayName || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium text-foreground">
                    {like.displayName || 'Unknown user'}
                  </span>
                </Link>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatLikedAt(like.likedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
