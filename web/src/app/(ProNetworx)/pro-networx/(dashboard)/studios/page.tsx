'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search as SearchIcon } from 'lucide-react';
import { studiosApi, type Studio } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { hasArtistCapability } from '@/lib/roles';

function formatStartingAt(studio: Studio): string {
  if (studio.startingAtCents == null) return 'Contact for pricing';
  const dollars = (studio.startingAtCents / 100).toFixed(2);
  const suffix =
    studio.startingAtUnit === 'day'
      ? '/day'
      : studio.startingAtUnit === 'half_day'
        ? '/half day'
        : studio.startingAtUnit === 'session'
          ? '/session'
          : '/hr';
  return `Starting at $${dollars}${suffix}`;
}

export default function StudiosDirectoryPage() {
  const { profile } = useAuth();
  const canCreate =
    hasArtistCapability(profile?.role) || profile?.role === 'service_provider';
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studiosApi.list({
        search: query.trim() || undefined,
        limit: 80,
      });
      setItems(res.data.items);
    } catch (e) {
      console.error('Failed to load studios:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Studios</h1>
          <p className="text-sm text-muted-foreground">
            Recording rooms with published rates. Exact pins are opt-in.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/pro-networx/me/studio" className="inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> My studio
            </Link>
          </Button>
        )}
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search studios…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No published studios yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((studio) => (
            <Link key={studio.id} href={`/pro-networx/studios/${studio.id}`}>
              <Card className="overflow-hidden h-full hover:border-cyan-400/50 transition-colors p-0">
                {studio.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={studio.heroImageUrl}
                    alt=""
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <div className="w-full h-36 bg-cyan-400/10" />
                )}
                <div className="p-4">
                  <div className="text-xs uppercase tracking-widest text-cyan-300 mb-2">
                    Studio
                  </div>
                  <div className="font-semibold text-foreground">{studio.name}</div>
                  {studio.tagline && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {studio.tagline}
                    </p>
                  )}
                  <p className="text-sm text-cyan-300 mt-3">{formatStartingAt(studio)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[studio.hoursSummary, studio.city, studio.zipCode]
                      .filter(Boolean)
                      .join(' · ') || 'Location coming soon'}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
