'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type BlockedUser = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  blockedAt: string;
};

export default function BlockedAccountsPage() {
  const [items, setItems] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.listBlockedUsers();
      setItems(res.data?.items ?? []);
    } catch {
      toast.error('Could not load blocked accounts.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = async (userId: string) => {
    setBusyId(userId);
    try {
      await usersApi.unblockUser(userId);
      setItems((prev) => prev.filter((item) => item.userId !== userId));
      toast.success('User unblocked.');
    } catch {
      toast.error('Could not unblock this user.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Blocked accounts</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          People you block cannot message you and their posts are hidden from
          your feed.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              You haven&apos;t blocked anyone.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.userId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <Link
                    href={`/pro-networx/u/${item.userId}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    {item.avatarUrl ? (
                      <Image
                        src={item.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm">
                        👤
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {item.displayName || 'User'}
                      </p>
                      {item.username && (
                        <p className="truncate text-sm text-muted-foreground">
                          @{item.username}
                        </p>
                      )}
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === item.userId}
                    onClick={() => void handleUnblock(item.userId)}
                  >
                    {busyId === item.userId ? 'Unblocking…' : 'Unblock'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
