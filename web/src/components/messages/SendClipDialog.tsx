'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, usersApi, type FollowListItem } from '@/lib/api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

export function SendClipDialog({
  open,
  file,
  caption,
  onOpenChange,
}: {
  open: boolean;
  file: File | null;
  caption: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<FollowListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || !profile?.id) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setDone(false);
    setSelected(new Set());
    usersApi
      .getFriends(profile.id, { limit: 200 })
      .then((res) => {
        if (!alive) return;
        setFriends(res.data?.items ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setError('Could not load your friends.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, profile?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (!file || selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      const typed = file.type.toLowerCase();
      const named = file.name.toLowerCase();
      const mime = typed.startsWith('image/')
        ? typed
        : typed.includes('webm') || named.endsWith('.webm')
          ? 'video/webm'
          : 'video/mp4';
      const filename = mime.includes('png')
        ? 'networx-clip.png'
        : mime.includes('webp')
          ? 'networx-clip.webp'
          : mime.startsWith('image/')
            ? 'networx-clip.jpg'
            : mime === 'video/webm'
              ? 'networx-clip.webm'
              : 'networx-clip.mp4';
      const messageType = mime.startsWith('image/') ? 'image' : 'video';
      const uploadUrl = await messagesApi.getUploadUrl({ filename, contentType: mime });
      const { signedUrl, path } = uploadUrl.data;
      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: file,
      });
      if (!response.ok) throw new Error('Upload failed');
      const base = supabaseUrl.replace(/\/$/, '');
      if (!base || !path) throw new Error('Could not upload the clip');
      const mediaUrl = `${base}/storage/v1/object/public/dm-media/${path}`;
      await Promise.all(
        [...selected].map((friendId) =>
          messagesApi.sendMessage(friendId, {
            body: caption,
            messageType,
            mediaUrl,
            mediaMime: mime,
          }),
        ),
      );
      setDone(true);
      setTimeout(() => onOpenChange(false), 900);
    } catch {
      setError('Could not send the clip. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to friends</DialogTitle>
          <DialogDescription>
            The song is in the video. Friends get it in their messages.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-foreground">Sent.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No friends yet. Follow people who follow you back, then send the clip.
          </p>
        ) : (
          <ul className="space-y-1">
            {friends.map((friend) => {
              const label = (friend.displayName || friend.username || 'Friend').trim();
              const checked = selected.has(friend.id);
              return (
                <li key={friend.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={sending}
                      onChange={() => toggle(friend.id)}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={sending || selected.size === 0 || done} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
