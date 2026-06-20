'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { proNetworxApi, usersApi } from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { NETWORX_LOGO } from '@/lib/brand-assets';
import { Reveal } from '@/components/dimension/Reveal';
import { cn } from '@/lib/utils';

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
  isFollowing?: boolean;
  updatedAt: string | null;
};

const PAGE_SIZE = 24;

// Brand mark used as a fallback when a profile has no media preview. Uses the
// official cyan wordmark; the old blue/wordless logos were retired.
const FALLBACK_LOGOS = [NETWORX_LOGO] as const;

function shouldUnoptimizeImage(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

// Deterministic pick so a profile always shows the same logo (no flicker on
// re-render) while spreading evenly across the available brand marks.
function fallbackLogoFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return FALLBACK_LOGOS[Math.abs(hash) % FALLBACK_LOGOS.length];
}

function formatStartingAt(cents: number | null, rateType: 'hourly' | 'fixed' | null): string {
  if (cents == null) return 'Contact for pricing';
  const dollars = (cents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

const dimInputClass =
  'w-full bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 transition-all';

const dimBtnPrimary =
  'inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-cyan-400 text-black font-dim-mono text-[11px] tracking-[0.2em] uppercase font-bold glow-cyan hover:bg-white transition-colors disabled:opacity-50';

const dimBtnOutline =
  'inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-white/20 text-white font-dim-mono text-[11px] tracking-[0.2em] uppercase hover:border-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50';

const dimBtnGhost =
  'inline-flex items-center justify-center px-4 py-2 rounded-full border border-white/15 text-white/80 font-dim-mono text-[10px] tracking-[0.15em] uppercase hover:border-pink-400/50 hover:text-pink-300 transition-colors disabled:opacity-50';

function DimensionDirectoryTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const last = words.pop() ?? title;
  const rest = words.join(' ');
  return (
    <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl sm:text-4xl md:text-5xl">
      {rest ? `${rest} ` : ''}
      <span className="text-glow-cyan text-cyan-300">{last}</span>
    </h1>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  showEditProfile?: boolean;
  // Home uses a curated ranking (services-first, then artists by music)
  // and hides empty profiles; the standalone directory defaults to random.
  smartRanking?: boolean;
};

export function ProNetworxDirectoryContent({
  title = 'Directory',
  subtitle = 'Find Catalysts by skill, availability, and location.',
  showEditProfile = true,
  smartRanking = false,
}: Props) {
  const { profile } = useAuth();
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
  // Home defaults to the curated ranking; the standalone directory shuffles.
  const [randomMode, setRandomMode] = useState(!smartRanking);
  const [randomSeed, setRandomSeed] = useState(() => String(Date.now()));
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});

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
      mode: randomMode
        ? ('random' as const)
        : smartRanking
          ? ('smart' as const)
          : ('default' as const),
      seed: randomMode ? randomSeed : undefined,
    };
  }, [search, location, skill, availableOnly, randomMode, randomSeed, smartRanking]);

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

  const toggleFollow = async (targetUserId: string, currentlyFollowing: boolean) => {
    setFollowBusy((prev) => ({ ...prev, [targetUserId]: true }));
    const prev = items;
    setItems((current) =>
      current.map((p) =>
        p.userId === targetUserId ? { ...p, isFollowing: !currentlyFollowing } : p,
      ),
    );
    try {
      if (currentlyFollowing) await usersApi.unfollow(targetUserId);
      else await usersApi.follow(targetUserId);
    } catch {
      setItems(prev);
    } finally {
      setFollowBusy((prevState) => ({ ...prevState, [targetUserId]: false }));
    }
  };

  return (
    <div className="space-y-6 pb-8" data-testid="pro-directory-content">
      <Reveal>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="font-dim-mono text-[10px] tracking-[0.3em] text-yellow-300/90">
            ◤ PRO-NETWORX · {smartRanking ? 'HOME' : 'DIRECTORY'}
          </div>
          <DimensionDirectoryTitle title={title} />
          <p className="text-white/60 text-sm sm:text-base max-w-xl">{subtitle}</p>
          {showEditProfile && (
            <Link href="/pro-networx/onboarding" className={dimBtnPrimary}>
              Create / edit my profile
            </Link>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="rounded-2xl glass p-5 sm:p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              type="text"
              placeholder="Search name or headline…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={dimInputClass}
            />
            <input
              type="text"
              placeholder="Location (region)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={dimInputClass}
            />
            <input
              type="text"
              placeholder="Skill (e.g. producer, studio)"
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              className={dimInputClass}
            />
            <div className="flex items-center gap-2 px-1">
              <Switch id="available-only" checked={availableOnly} onCheckedChange={setAvailableOnly} />
              <Label htmlFor="available-only" className="text-sm text-white/80">
                Available for work
              </Label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="pn-random" checked={randomMode} onCheckedChange={setRandomMode} />
            <Label htmlFor="pn-random" className="text-sm text-white/80">
              Random profiles
            </Label>
            {randomMode && (
              <button
                type="button"
                className={dimBtnGhost}
                onClick={() => setRandomSeed(String(Date.now()))}
              >
                Shuffle
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={dimBtnOutline}
              onClick={() => load(false, 0)}
              disabled={loading}
            >
              Apply filters
            </button>
            <button
              type="button"
              className={dimBtnGhost}
              onClick={() => {
                setSearch('');
                setLocation('');
                setSkill('');
                setAvailableOnly(false);
              }}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </div>
      </Reveal>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        </div>
      ) : (
        <>
          <p className="font-dim-mono text-[11px] tracking-[0.25em] text-white/50">
            {total} RESULTS
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, i) => (
              <Reveal key={p.userId} delay={(i % 6) * 0.05} y={24}>
                <div className="tilt group rounded-2xl tracing-border glass overflow-hidden h-full flex flex-col">
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    {p.mediaPreviewUrl && p.mediaPreviewType === 'image' ? (
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/40">
                        <Image
                          src={p.mediaPreviewUrl}
                          alt={p.serviceTitle ?? p.displayName ?? 'Preview'}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          unoptimized={shouldUnoptimizeImage(p.mediaPreviewUrl)}
                        />
                      </div>
                    ) : (
                      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-gradient-to-br from-black/80 to-cyan-950/30 flex items-center justify-center p-6">
                        <Image
                          src={fallbackLogoFor(p.userId)}
                          alt="Networx"
                          width={120}
                          height={120}
                          sizes="120px"
                          className="object-contain opacity-80 max-h-full max-w-full w-auto h-auto"
                        />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-unbounded font-black text-base text-white truncate">
                          {p.serviceTitle?.replace(/_/g, ' ') ||
                            p.skills[0]?.replace(/_/g, ' ') ||
                            (p.role === 'service_provider' ? 'Service' : 'Artist')}
                        </p>
                        <p className="text-xs text-white/50 truncate font-dim-mono tracking-wide">
                          {p.currentTitle || p.skillsHeadline || p.headline || '—'}
                        </p>
                      </div>
                      {p.verifiedCatalyst && (
                        <span className="shrink-0 rounded-full bg-yellow-300/15 border border-yellow-300/40 px-2 py-0.5 font-dim-mono text-[9px] tracking-[0.15em] text-yellow-300 uppercase">
                          Verified
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {p.avatarUrl ? (
                        <Image
                          src={p.avatarUrl}
                          alt={p.displayName ?? 'Avatar'}
                          width={56}
                          height={56}
                          className="rounded-full object-cover border border-cyan-400/30"
                          unoptimized={shouldUnoptimizeImage(p.avatarUrl)}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-xl text-cyan-300">
                          ✦
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/pro-networx/u/${p.userId}`}
                            className="font-semibold text-white truncate hover:text-cyan-300 transition-colors"
                          >
                            {p.displayName || 'Unnamed'}
                          </Link>
                          {p.availableForWork && (
                            <span className="rounded-full bg-cyan-400/15 border border-cyan-400/30 px-2 py-0.5 font-dim-mono text-[9px] text-cyan-300 uppercase tracking-wider">
                              Available
                            </span>
                          )}
                          {p.mentorOptIn && (
                            <span className="rounded-full bg-pink-400/10 border border-pink-400/30 px-2 py-0.5 font-dim-mono text-[9px] text-pink-300 uppercase tracking-wider">
                              Mentor
                            </span>
                          )}
                        </div>
                        {p.locationRegion && (
                          <p className="text-xs text-white/45 truncate">{p.locationRegion}</p>
                        )}
                      </div>
                    </div>

                    {p.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.skills.slice(0, 5).map((s) => (
                          <span
                            key={s}
                            className="rounded-full border border-white/10 px-2 py-0.5 font-dim-mono text-[9px] tracking-wide text-white/60 uppercase"
                          >
                            {s.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-sm text-white/50">
                      Starting at{' '}
                      <span className="text-cyan-300 font-semibold">
                        {formatStartingAt(p.startingAtCents ?? null, p.startingAtRateType ?? null)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                      <Link
                        href={`/pro-networx/u/${p.userId}`}
                        className={cn(dimBtnGhost, 'flex-1 min-w-[7rem]')}
                      >
                        View profile
                      </Link>
                      {profile?.id !== p.userId ? (
                        <button
                          type="button"
                          className={cn(
                            p.isFollowing ? dimBtnGhost : dimBtnOutline,
                            'min-w-[5.5rem]',
                          )}
                          disabled={!!followBusy[p.userId]}
                          onClick={() => toggleFollow(p.userId, !!p.isFollowing)}
                        >
                          {followBusy[p.userId]
                            ? '...'
                            : p.isFollowing
                              ? 'Following'
                              : 'Follow'}
                        </button>
                      ) : (
                        <span className={cn(dimBtnGhost, 'opacity-50 cursor-default')}>You</span>
                      )}
                      <Link
                        href={`/messages?with=${p.userId}`}
                        className={cn(dimBtnPrimary, 'flex-1 min-w-[7rem]')}
                      >
                        Message
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 glass p-12 text-center">
              <p className="font-unbounded font-black text-xl text-white mb-2">No matches</p>
              <p className="text-white/50 text-sm">Try widening your filters.</p>
            </div>
          )}

          {hasMore && items.length > 0 && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                className={dimBtnOutline}
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
