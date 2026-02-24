'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { proNetworxApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type DirectoryItem = {
  userId: string;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  locationRegion: string | null;
  availableForWork: boolean;
  skillsHeadline: string | null;
  skills: string[];
  serviceTitle?: string | null;
  mediaPreviewUrl?: string | null;
  mediaPreviewType?: 'image' | 'video' | 'audio' | null;
  startingAtCents?: number | null;
  startingAtRateType?: 'hourly' | 'fixed' | null;
  verifiedCatalyst?: boolean;
  mentorOptIn?: boolean;
  updatedAt: string | null;
};

const PAGE_SIZE = 24;

export default function DirectoryPage() {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [skill, setSkill] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const params = useMemo(() => {
    const s = search.trim() || undefined;
    const l = location.trim() || undefined;
    const sk = skill.trim().toLowerCase().replace(/\s+/g, '_') || undefined;
    return {
      search: s,
      location: l,
      skill: sk,
      availableForWork: availableOnly ? true : undefined,
      sort: 'desc' as const,
    };
  }, [search, location, skill, availableOnly]);

  const load = useCallback(async (append: boolean, currentOffset: number) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await proNetworxApi.listDirectory(params);
      const data = res.data as { items: DirectoryItem[]; total: number };
      const page = (data.items ?? []).slice(currentOffset, currentOffset + PAGE_SIZE);
      if (append) setItems((prev) => [...prev, ...page]);
      else setItems(page);
      setTotal(data.total ?? data.items?.length ?? 0);
      setHasMore(page.length === PAGE_SIZE);
      setOffset(currentOffset + page.length);
    } catch (e) {
      console.error('Failed to load directory:', e);
      if (!append) setItems([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [params]);

  useEffect(() => {
    setOffset(0);
    load(false, 0);
  }, [load]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    load(true, offset);
  };

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Directory</h1>
          <p className="text-muted-foreground">
            Find collaborators by skill, availability, and signal.
          </p>
        </div>
        <Button asChild className="bg-networx text-black hover:opacity-90">
          <Link href="/onboarding">Create / edit my profile</Link>
        </Button>
      </div>

      <Card className="glass-panel border border-primary/20">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search name or headline…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Input
              placeholder="Location (region)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Input
              placeholder="Skill (e.g. producer, studio)"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Switch id="available-only" checked={availableOnly} onCheckedChange={setAvailableOnly} />
              <Label htmlFor="available-only" className="text-sm">Available only</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load(false, 0)} disabled={loading}>
              Apply filters
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSearch(''); setLocation(''); setSkill(''); setAvailableOnly(false); }}
              disabled={loading}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} results</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Card
                key={p.userId}
                className="service-card overflow-hidden"
              >
                <CardContent className="p-4 space-y-3">
                  {/* Media preview */}
                  {p.mediaPreviewUrl ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-primary/15 bg-black/20">
                      {p.mediaPreviewType === 'video' ? (
                        <video
                          src={p.mediaPreviewUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : p.mediaPreviewType === 'audio' ? (
                        <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                          Audio preview
                        </div>
                      ) : (
                        <Image
                          src={p.mediaPreviewUrl}
                          alt={p.serviceTitle ?? p.displayName ?? 'Preview'}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full aspect-video rounded-lg border border-primary/15 bg-background/20 flex items-center justify-center text-muted-foreground text-sm">
                      No preview yet
                    </div>
                  )}

                  {/* Service title */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {p.serviceTitle?.replace(/_/g, ' ') || (p.skills[0]?.replace(/_/g, ' ') ?? 'Service')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.skillsHeadline || p.headline || '—'}
                      </p>
                    </div>
                    {p.verifiedCatalyst && (
                      <Badge className="bg-primary text-primary-foreground shrink-0">
                        Verified Catalyst
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {p.avatarUrl ? (
                      <Image
                        src={p.avatarUrl}
                        alt={p.displayName ?? 'Avatar'}
                        width={56}
                        height={56}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-xl border border-border/60">
                        ✦
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/u/${p.userId}`} className="font-semibold truncate hover:underline">
                          {p.displayName || 'Unnamed'}
                        </Link>
                        {p.availableForWork && (
                          <Badge className="bg-[color:var(--rose-gold)] text-black">Live</Badge>
                        )}
                        {p.mentorOptIn && (
                          <Badge variant="outline" className="border-primary/30">Mentor</Badge>
                        )}
                      </div>
                      {p.locationRegion && (
                        <p className="text-xs text-muted-foreground truncate">📍 {p.locationRegion}</p>
                      )}
                    </div>
                  </div>

                  {p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.skills.slice(0, 5).map((s) => (
                        <Badge key={s} variant="outline" className="border-primary/30 text-xs">
                          {s.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-muted-foreground font-mono">
                      {p.startingAtCents != null ? (
                        <span>
                          Starting at <span className="text-foreground font-semibold">${(p.startingAtCents / 100).toFixed(2)}</span>
                          {p.startingAtRateType === 'hourly' ? <span className="text-muted-foreground">/hr</span> : null}
                        </span>
                      ) : (
                        <span>Starting at —</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/u/${p.userId}`}>View profile</Link>
                    </Button>
                    <Button size="sm" asChild className="flex-1">
                      <Link href={`/messages?with=${p.userId}`}>Message</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!loading && items.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No matches. Try widening your filters.</p>
          )}

          {hasMore && items.length > 0 && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

