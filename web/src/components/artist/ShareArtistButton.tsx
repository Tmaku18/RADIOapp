'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { messagesApi, studiosApi } from '@/lib/api';
import { artistShareText, artistShareUrl, shareLink } from '@/lib/radio-share';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Person = {
  userId: string;
  displayName: string | null;
};

function errorText(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return 'Could not send that message.';
}

export function ShareArtistButton({
  artistId,
  artistName,
  shareText,
  shareUrl,
  className,
}: {
  artistId: string;
  artistName: string;
  shareText?: string;
  shareUrl?: string;
  className?: string;
}) {
  const { profile } = useAuth();
  const [dmOpen, setDmOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const shareBody = shareText ?? artistShareText({ artistName, artistId });
  const link = shareUrl ?? artistShareUrl(artistId);

  useEffect(() => {
    if (!dmOpen) return;
    let ignore = false;
    const handle = window.setTimeout(() => {
      setLoadingPeople(true);
      const q = query.trim();
      const recent = messagesApi
        .listConversations({ search: q || undefined })
        .then((res) => {
          const rows = (res.data ?? []) as Array<{
            otherUserId?: string;
            otherDisplayName?: string | null;
          }>;
          return rows
            .filter((row) => row.otherUserId && row.otherUserId !== profile?.id)
            .map((row) => ({
              userId: row.otherUserId as string,
              displayName: row.otherDisplayName ?? null,
            }));
        })
        .catch(() => [] as Person[]);
      const found =
        q.length >= 2
          ? studiosApi
              .searchPeople(q)
              .then((res) =>
                (res.data.items ?? [])
                  .filter((person) => person.userId && person.userId !== profile?.id)
                  .map((person) => ({
                    userId: person.userId,
                    displayName: person.displayName,
                  })),
              )
              .catch(() => [] as Person[])
          : Promise.resolve([] as Person[]);
      Promise.all([recent, found])
        .then(([conversations, searchHits]) => {
          if (ignore) return;
          const seen = new Set<string>();
          const merged: Person[] = [];
          for (const person of [...searchHits, ...conversations]) {
            if (seen.has(person.userId)) continue;
            seen.add(person.userId);
            merged.push(person);
          }
          setPeople(merged);
        })
        .finally(() => {
          if (!ignore) setLoadingPeople(false);
        });
    }, 250);
    return () => {
      ignore = true;
      window.clearTimeout(handle);
    };
  }, [dmOpen, query, profile?.id]);

  const sendText = async () => {
    const result = await shareLink(shareBody, link);
    if (result === 'copied') {
      toast.success('Link copied. Paste it into a text.');
    } else if (result === 'failed') {
      toast.error('Could not open a text.');
    }
  };

  const openDm = () => {
    if (!profile?.id) {
      toast.error('Log in to send this profile in a message.');
      return;
    }
    setQuery('');
    setPeople([]);
    setDmOpen(true);
  };

  const sendDm = async (person: Person) => {
    setSendingId(person.userId);
    try {
      await messagesApi.sendMessage(person.userId, { body: shareBody });
      toast.success(`Sent to ${person.displayName || 'them'}.`);
      setDmOpen(false);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn('w-full sm:w-auto', className)}>
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void sendText()}>
            Text
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openDm}>Send in a DM</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dmOpen} onOpenChange={setDmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send profile</DialogTitle>
            <DialogDescription>
              Pick someone to send {artistName}&apos;s profile.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            autoFocus
          />
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loadingPeople && (
              <p className="px-1 py-2 text-sm text-muted-foreground">Loading…</p>
            )}
            {!loadingPeople && people.length === 0 && (
              <p className="px-1 py-2 text-sm text-muted-foreground">
                {query.trim().length >= 2
                  ? 'No one matches that name.'
                  : 'Recent messages show up here. Search to find someone else.'}
              </p>
            )}
            {people.map((person) => (
              <button
                key={person.userId}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                disabled={sendingId === person.userId}
                onClick={() => void sendDm(person)}
              >
                <span className="truncate">{person.displayName || 'Member'}</span>
                <span className="text-xs text-muted-foreground">
                  {sendingId === person.userId ? 'Sending…' : 'Send'}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
