'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { proNetworxApi } from '@/lib/api';
import { usersApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

type ProviderListing = {
  id: string;
  serviceType: string;
  title: string;
  description: string | null;
  rateCents: number | null;
  rateType: 'hourly' | 'fixed';
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
};

type PortfolioItem = {
  id: string;
  type: 'image' | 'audio' | 'video';
  fileUrl: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

type ProPublicProfile = {
  userId: string;
  role: 'listener' | 'artist' | 'admin' | 'service_provider' | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  bio?: string | null;
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
  listings?: ProviderListing[];
  portfolio?: PortfolioItem[];
};

function formatRate(rateCents: number | null, rateType: 'hourly' | 'fixed'): string {
  if (rateCents == null) return 'Contact for pricing';
  const dollars = (rateCents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

export default function ProProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { profile } = useAuth();
  const myUserId = profile?.id ?? null;

  const [data, setData] = useState<ProPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let alive = true;
     
    setLoading(true);
    proNetworxApi.getProfileByUserId(id).then((res) => {
      if (!alive) return;
      setData(res.data as ProPublicProfile);
    }).catch((e) => {
      console.error('Failed to load profile:', e);
      if (alive) setData(null);
    }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    let alive = true;
    if (!id || !myUserId || id === myUserId) return;
    usersApi
      .isFollowing(id)
      .then((res) => {
        if (!alive) return;
        setIsFollowing(Boolean((res.data as { following?: boolean })?.following));
      })
      .catch(() => {
        if (alive) setIsFollowing(false);
      });
    return () => {
      alive = false;
    };
  }, [id, myUserId]);

  const toggleFollow = async () => {
    if (!id || !myUserId || id === myUserId || followBusy) return;
    setFollowBusy(true);
    const prev = isFollowing;
    setIsFollowing(!prev);
    try {
      if (prev) await usersApi.unfollow(id);
      else await usersApi.follow(id);
    } catch {
      setIsFollowing(prev);
    } finally {
      setFollowBusy(false);
    }
  };

  const activeListings = useMemo(() => (data?.listings ?? []).filter((l) => l.status === 'active'), [data?.listings]);

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : !data ? (
        <Card className="glass-panel border border-primary/20">
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
            Profile not found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header / Wake banner */}
          <Card className="glass-panel border border-primary/20 overflow-hidden">
            <div className="relative w-full h-44 md:h-56 bg-signature">
              {data.mediaPreviewUrl && data.mediaPreviewType === 'image' && (
                <Image
                  src={data.mediaPreviewUrl}
                  alt=""
                  fill
                  className="object-cover opacity-70"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 flex items-end gap-4">
                {data.avatarUrl ? (
                  <Image
                    src={data.avatarUrl}
                    alt={data.displayName ?? 'Avatar'}
                    width={84}
                    height={84}
                    className="rounded-full object-cover border border-primary/30"
                  />
                ) : (
                  <div className="w-[84px] h-[84px] rounded-full bg-muted border border-primary/20 flex items-center justify-center text-2xl">
                    ✦
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
                      {data.displayName || 'Unnamed'}
                    </h1>
                    {data.verifiedCatalyst && (
                      <Badge className="bg-primary text-primary-foreground">Verified Catalyst</Badge>
                    )}
                    {data.availableForWork && (
                      <Badge className="bg-[color:var(--rose-gold)] text-black">Live</Badge>
                    )}
                    {data.mentorOptIn && (
                      <Badge variant="outline" className="border-primary/30">Mentor</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {data.skillsHeadline || data.headline || '—'}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {data.locationRegion && (
                      <span className="text-xs text-muted-foreground">📍 {data.locationRegion}</span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">
                      {data.startingAtCents != null
                        ? `Starting at $${(data.startingAtCents / 100).toFixed(2)}${data.startingAtRateType === 'hourly' ? '/hr' : ''}`
                        : 'Starting at —'}
                    </span>
                  </div>
                </div>
                <div className="hidden md:flex gap-2 shrink-0">
                  {myUserId && myUserId !== data.userId && (
                    <Button
                      variant={isFollowing ? 'outline' : 'secondary'}
                      onClick={toggleFollow}
                      disabled={followBusy}
                    >
                      {followBusy ? '...' : isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  )}
                  <Button asChild>
                    <Link href={`/messages?with=${data.userId}`}>Message</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/directory">Back</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Left: bio + portfolio */}
            <div className="space-y-6">
              <Card className="glass-panel border border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-lg font-semibold">Profile</h2>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {data.bio?.trim() || 'No bio yet.'}
                  </p>
                  {data.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((s) => (
                        <Badge key={s} variant="outline" className="border-primary/30">
                          {s.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-panel border border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold">Portfolio</h2>
                    <span className="text-xs text-muted-foreground">{(data.portfolio ?? []).length} items</span>
                  </div>
                  {(data.portfolio ?? []).length === 0 ? (
                    <p className="text-muted-foreground">No portfolio items yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(data.portfolio ?? []).slice(0, 6).map((p) => (
                        <Card key={p.id} className="overflow-hidden border border-primary/15 bg-card/50">
                          <CardContent className="pt-5 space-y-2">
                            {p.type === 'image' && (
                               
                              <img src={p.fileUrl} alt={p.title ?? 'Portfolio'} className="w-full h-40 object-cover rounded-md border" />
                            )}
                            {p.type === 'video' && (
                              <div className="w-full aspect-video rounded-md overflow-hidden bg-muted">
                                <video src={p.fileUrl} controls className="w-full h-full object-contain" title={p.title ?? 'Video'} />
                              </div>
                            )}
                            {p.type === 'audio' && <audio controls src={p.fileUrl} className="w-full" />}
                            {p.title && <p className="font-medium">{p.title}</p>}
                            {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Service menu */}
            <div className="space-y-6">
              <Card className="glass-panel border border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Service menu</h2>
                    <Badge variant="outline" className="border-primary/30">{activeListings.length} active</Badge>
                  </div>
                  {activeListings.length === 0 ? (
                    <p className="text-muted-foreground">No active listings yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeListings.map((l) => (
                        <Card key={l.id} className="border border-primary/15 bg-card/50">
                          <CardContent className="pt-5 space-y-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{l.title}</p>
                                <p className="text-xs text-muted-foreground capitalize">{l.serviceType.replace(/_/g, ' ')}</p>
                              </div>
                              <span className="text-sm font-mono text-foreground shrink-0">{formatRate(l.rateCents, l.rateType)}</span>
                            </div>
                            {l.description && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {l.description}
                              </p>
                            )}
                            <div className="pt-2">
                              <Button asChild size="sm" className="w-full">
                                <Link href={`/messages?with=${data.userId}`}>Send a Ripple (DM)</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="md:hidden flex gap-2">
                {myUserId && myUserId !== data.userId && (
                  <Button
                    variant={isFollowing ? 'outline' : 'secondary'}
                    onClick={toggleFollow}
                    disabled={followBusy}
                    className="flex-1"
                  >
                    {followBusy ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
                <Button asChild className="flex-1">
                  <Link href={`/messages?with=${data.userId}`}>Message</Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/directory">Back</Link>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

