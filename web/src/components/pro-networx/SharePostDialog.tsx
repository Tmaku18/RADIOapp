'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import {
  usersApi,
  messagesApi,
  type DiscoverFeedPost,
  type FollowListItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

interface SharePostDialogProps {
  post: DiscoverFeedPost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SharePostDialog({ post, open, onOpenChange }: SharePostDialogProps) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<FollowListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setError(null);
    setSelected(new Set());
    setNote('');
    setSearch('');
    if (!profile?.id) return;
    let alive = true;
    setLoading(true);
    usersApi
      .getFriends(profile.id, { limit: 200 })
      .then((res) => {
        if (!alive) return;
        setFriends(res.data?.items ?? []);
      })
      .catch(() => {
        if (alive) setFriends([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, profile?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = friends ?? [];
    if (!term) return list;
    return list.filter(
      (f) =>
        (f.displayName ?? '').toLowerCase().includes(term) ||
        (f.username ?? '').toLowerCase().includes(term),
    );
  }, [friends, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (sending || selected.size === 0) return;
    setSending(true);
    setError(null);
    try {
      await Promise.all(
        [...selected].map((friendId) =>
          messagesApi.sendMessage(friendId, {
            messageType: 'post_share',
            sharedPostId: post.id,
            body: note.trim() || undefined,
          }),
        ),
      );
      setDone(true);
      setTimeout(() => onOpenChange(false), 900);
    } catch {
      setError('Could not send to some friends. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share with friends</DialogTitle>
          <DialogDescription>
            Friends are people you follow who follow you back. They&apos;ll get
            this post in a direct message.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p className="py-6 text-center text-sm text-foreground">Sent!</p>
        ) : (
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search friends…"
            />

            <div className="max-h-64 overflow-y-auto -mx-1 px-1">
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading friends…
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {friends && friends.length === 0
                    ? 'No friends yet. Follow people who follow you back to build your friends list.'
                    : 'No friends match your search.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((f) => {
                    const isSelected = selected.has(f.id);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => toggle(f.id)}
                          className={cn(
                            'w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors',
                            isSelected ? 'bg-accent' : 'hover:bg-accent/50',
                          )}
                        >
                          {f.avatarUrl ? (
                            <Image
                              src={f.avatarUrl}
                              alt={f.displayName ?? 'Friend'}
                              width={36}
                              height={36}
                              className="rounded-full object-cover"
                              unoptimized={shouldUnoptimize(f.avatarUrl)}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-muted" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">
                              {f.displayName || 'Friend'}
                            </p>
                            {f.username && (
                              <p className="text-xs text-muted-foreground truncate">
                                @{f.username}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              'h-5 w-5 rounded-full border flex items-center justify-center text-xs',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-border',
                            )}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a message (optional)"
              rows={2}
              className="resize-none"
            />

            {error && <p className="text-xs text-red-500">{error}</p>}

            <Button
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              className="w-full"
            >
              {sending
                ? 'Sending…'
                : selected.size > 0
                  ? `Send to ${selected.size} ${selected.size === 1 ? 'friend' : 'friends'}`
                  : 'Select friends'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
