'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fansApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type FanRow = { id: string; email: string; createdAt: string };

export function FanEmailCard({
  artistId,
  artistName,
  isOwner,
}: {
  artistId: string;
  artistName: string;
  isOwner: boolean;
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fans, setFans] = useState<FanRow[]>([]);

  useEffect(() => {
    if (!isOwner) return;
    let ignore = false;
    fansApi
      .mine()
      .then((res) => {
        if (!ignore) setFans(res.data.fans ?? []);
      })
      .catch(() => {
        if (!ignore) setFans([]);
      });
    return () => {
      ignore = true;
    };
  }, [isOwner]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fansApi.join(artistId, email);
      setStatus(
        res.data.already
          ? 'That email is already on the list.'
          : "You're on the list.",
      );
      setEmail('');
    } catch {
      setStatus('Enter a valid email and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (isOwner) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold">Email list</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fans.length === 0
              ? 'No one has joined yet.'
              : `${fans.length} ${fans.length === 1 ? 'person' : 'people'} asked to hear from you.`}
          </p>
          {fans.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm">
              {fans.map((fan) => (
                <li key={fan.id} className="truncate">
                  {fan.email}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-semibold">Hear from {artistName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave your email and this artist can write to you about new music.
        </p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
          />
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Join the list'}
          </Button>
        </form>
        {status && <p className="mt-2 text-sm">{status}</p>}
      </CardContent>
    </Card>
  );
}
