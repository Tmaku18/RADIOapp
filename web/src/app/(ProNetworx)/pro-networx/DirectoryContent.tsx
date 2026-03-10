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

export type DirectoryItem = {
  userId: string;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  currentTitle?: string | null;
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

function formatStartingAt(cents: number | null, rateType: 'hourly' | 'fixed' | null): string {
  if (cents == null) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

type Props = {
  title?: string;
  subtitle?: string;
  showEditProfile?: boolean;
};

export function ProNetworxDirectoryContent({
  title = 'Directory',
  subtitle = 'Find Catalysts by skill, availability, and location.',
  showEditProfile = true,
}: Props) {
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
    <div className="container max-w-6xl py-6 sm:py-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">{subtitle}</p>
        </div>
        {showEditProfile && (
          <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
            <Link href="/pro-networx/onboarding">Create / edit my profile</Link>
          </Button>
        )}
      </div>

      <Card className="glass-panel border border-border hover:border-primary/20 transition-colors">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search name or headline…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background border-border"
            />
            <Input
              placeholder="Location (region)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="bg-background border-border"
            />
            <Input
              placeholder="Skill (e.g. producer, studio)"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className="bg-background border-border"
            />
            <div className="flex items-center gap-2">
              <Switch id="available-only" checked={availableOnly} onCheckedChange={setAvailableOnly} />
              <Label htmlFor="available-only" className="text-sm text-foreground">Available for work</Label>
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
                className="overflow-hidden border border-border hover:border-primary/30 transition-colors bg-card"
              >
                <CardContent className="p-4 space-y-3">
                  {p.mediaPreviewUrl && p.mediaPreviewType === 'image' ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                      <Image
                        src={p.mediaPreviewUrl}
                        alt={p.serviceTitle ?? p.displayName ?? 'Preview'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video rounded-lg border border-border bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">
                      No preview
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {p.serviceTitle?.replace(/_/g, ' ') || (p.skills[0]?.replace(/_/g, ' ') ?? 'Service')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.currentTitle || p.skillsHeadline || p.headline || '—'}
                      </p>
                    </div>
                    {p.verifiedCatalyst && (
                      <Badge className="shrink-0 bg-[color:var(--brand-verified)] text-primary-foreground border-0">
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
                        className="rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-xl border border-border">
                        ✦
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/pro-networx/u/${p.userId}`} className="font-semibold text-foreground truncate hover:underline">
                          {p.displayName || 'Unnamed'}
                        </Link>
                        {p.availableForWork && (
                          <Badge variant="secondary" className="text-xs">Available</Badge>
                        )}
                        {p.mentorOptIn && (
                          <Badge variant="outline" className="border-primary/30 text-xs">Mentor</Badge>
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

                  <div className="text-sm text-muted-foreground">
                    Starting at <span className="text-foreground font-semibold">{formatStartingAt(p.startingAtCents ?? null, p.startingAtRateType ?? null)}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/pro-networx/u/${p.userId}`}>View profile</Link>
                    </Button>
                    <Button size="sm" asChild className="flex-1 bg-primary text-primary-foreground hover:opacity-90">
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
            <div className="flex justify-center pt-6 pb-4">
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
