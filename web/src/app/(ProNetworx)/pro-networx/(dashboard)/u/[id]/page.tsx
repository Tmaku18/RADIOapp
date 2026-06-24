'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { FileText, MessageSquare, Briefcase, UserPlus, UserCheck, Lock } from 'lucide-react';
import {
  discoveryApi,
  paymentsApi,
  proNetworxApi,
  usersApi,
  type DiscoverFeedPost,
  type EducationItem,
  type ExperienceItem,
  type FeaturedItem,
  type ProServiceListing,
} from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { UserSafetyMenu } from '@/components/safety/UserSafetyMenu';

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
  role: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  currentTitle?: string | null;
  bio?: string | null;
  about?: string | null;
  locationRegion: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  soundcloudUrl?: string | null;
  spotifyUrl?: string | null;
  appleMusicUrl?: string | null;
  facebookUrl?: string | null;
  snapchatUrl?: string | null;
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
  heroImageUrl?: string | null;
  resumeUrl?: string | null;
  resumeFilename?: string | null;
  resumeLocked?: boolean;
  messagingLocked?: boolean;
  updatedAt: string | null;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  featured?: FeaturedItem[];
  listings?: ProviderListing[];
  portfolio?: PortfolioItem[];
};

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

function formatPriceCents(
  cents: number | null,
  rateType: 'hourly' | 'fixed' | null | undefined,
): string {
  if (cents == null) return 'Contact for pricing';
  return `$${(cents / 100).toFixed(2)}${rateType === 'hourly' ? '/hr' : ''}`;
}

export default function ProNetworxProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { user, profile } = useAuth();
  const isMe = profile?.id === id;

  const [data, setData] = useState<ProPublicProfile | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [services, setServices] = useState<ProServiceListing[]>([]);
  const [portfolioPosts, setPortfolioPosts] = useState<DiscoverFeedPost[]>([]);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{
    blockedByMe: boolean;
    blockedMe: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    proNetworxApi
      .getProfileByUserId(id)
      .then((res) => {
        if (!alive) return;
        setData(res.data as ProPublicProfile);
        setLoadError(false);
        setLoadedId(id);
      })
      .catch((e) => {
        console.error('Failed to load profile:', e);
        if (alive) {
          setData(null);
          setLoadError(true);
          setLoadedId(id);
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const loadServices = useCallback(async () => {
    try {
      const res = await proNetworxApi.listServicesForUser(id);
      setServices(res.data.items);
    } catch {
      setServices([]);
    }
  }, [id]);

  const loadPortfolioPosts = useCallback(async () => {
    try {
      const res = await discoveryApi.listUserPosts(id, { limit: 24 });
      setPortfolioPosts(res.data.items);
    } catch {
      setPortfolioPosts([]);
    }
  }, [id]);

  useEffect(() => {
    void loadServices();
    void loadPortfolioPosts();
  }, [loadServices, loadPortfolioPosts]);

  // Load follow state (skip for own profile / before auth resolves).
  useEffect(() => {
    if (!user || isMe) {
      setFollowing(null);
      return;
    }
    let alive = true;
    usersApi
      .isFollowing(id)
      .then((res) => {
        if (alive) setFollowing(!!res.data?.following);
      })
      .catch(() => {
        if (alive) setFollowing(false);
      });
    return () => {
      alive = false;
    };
  }, [id, user, isMe]);

  useEffect(() => {
    if (!user || isMe) {
      setBlockStatus(null);
      return;
    }
    let alive = true;
    usersApi
      .getBlockStatus(id)
      .then((res) => {
        if (alive) {
          setBlockStatus({
            blockedByMe: !!res.data?.blockedByMe,
            blockedMe: !!res.data?.blockedMe,
          });
        }
      })
      .catch(() => {
        if (alive) setBlockStatus({ blockedByMe: false, blockedMe: false });
      });
    return () => {
      alive = false;
    };
  }, [id, user, isMe]);

  const handleToggleFollow = useCallback(async () => {
    if (followBusy || following == null) return;
    setFollowBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      if (next) await usersApi.follow(id);
      else await usersApi.unfollow(id);
    } catch {
      setFollowing(!next);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, following, id]);

  // Resumes and DMs carry contact info, so non-subscribers see the buttons but
  // are routed to Pro-Networx subscription checkout instead of the file/thread.
  const [proCheckoutBusy, setProCheckoutBusy] = useState(false);
  const handleProSubscribe = useCallback(async () => {
    if (proCheckoutBusy) return;
    setProCheckoutBusy(true);
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const path =
        typeof window !== 'undefined'
          ? window.location.pathname
          : '/pro-networx/home';
      const res = await paymentsApi.createProNetworxCheckoutSession({
        successUrl: `${origin}${path}?pn_sub=success`,
        cancelUrl: `${origin}${path}?pn_sub=cancel`,
      });
      const url = (res.data as { url?: string })?.url;
      if (url) {
        window.location.href = url;
        return;
      }
    } catch {
      // Swallow; the user can retry the button.
    } finally {
      setProCheckoutBusy(false);
    }
  }, [proCheckoutBusy]);

  const loading = loadedId !== id;
  const socialLinks = useMemo(
    () =>
      [
        { label: 'Website', url: data?.websiteUrl ?? null },
        { label: 'Instagram', url: data?.instagramUrl ?? null },
        { label: 'Twitter/X', url: data?.twitterUrl ?? null },
        { label: 'YouTube', url: data?.youtubeUrl ?? null },
        { label: 'TikTok', url: data?.tiktokUrl ?? null },
        { label: 'SoundCloud', url: data?.soundcloudUrl ?? null },
        { label: 'Spotify', url: data?.spotifyUrl ?? null },
        { label: 'Apple Music', url: data?.appleMusicUrl ?? null },
        { label: 'Facebook', url: data?.facebookUrl ?? null },
        { label: 'Snapchat', url: data?.snapchatUrl ?? null },
      ].filter((item) => !!item.url?.trim()),
    [data],
  );
  const experience = (data?.experience ?? []).filter(
    (e) => e.title?.trim() || e.company?.trim(),
  );
  const education = (data?.education ?? []).filter((e) => e.school?.trim());
  const featured = (data?.featured ?? []).filter(
    (f) => f.url?.trim() || f.title?.trim(),
  );
  const aboutText = (data?.about ?? data?.bio ?? '').trim();
  const headlineText =
    data?.currentTitle ?? data?.skillsHeadline ?? data?.headline ?? '—';

  return (
    <div className="container max-w-6xl py-6 sm:py-8">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : !data || loadError ? (
        <Card className="glass-panel border border-border">
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
            Profile not found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Hero / banner card */}
          <Card className="glass-panel border border-border overflow-hidden mb-6">
            <div className="relative w-full h-32 sm:h-44 bg-muted/50">
              {data.heroImageUrl ? (
                <Image
                  src={data.heroImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized={shouldUnoptimize(data.heroImageUrl)}
                />
              ) : data.mediaPreviewUrl && data.mediaPreviewType === 'image' ? (
                <Image
                  src={data.mediaPreviewUrl}
                  alt=""
                  fill
                  className="object-cover opacity-80"
                  unoptimized={shouldUnoptimize(data.mediaPreviewUrl)}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>
            <CardContent className="relative px-4 sm:px-6 pb-6 -mt-16 sm:-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-end gap-4">
                  {data.avatarUrl ? (
                    <Image
                      src={data.avatarUrl}
                      alt={data.displayName ?? 'Avatar'}
                      width={128}
                      height={128}
                      className="rounded-full object-cover border-4 border-background shadow-lg size-24 sm:size-32 shrink-0"
                      unoptimized={shouldUnoptimize(data.avatarUrl)}
                    />
                  ) : (
                    <div className="size-24 sm:size-32 rounded-full bg-muted border-4 border-background flex items-center justify-center text-4xl shrink-0">
                      ✦
                    </div>
                  )}
                  <div className="pb-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                      {data.displayName || 'Unnamed'}
                    </h1>
                    <p className="text-muted-foreground mt-0.5">{headlineText}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {data.locationRegion && <span>📍 {data.locationRegion}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.verifiedCatalyst && (
                        <Badge className="bg-[color:var(--brand-verified)] text-primary-foreground border-0">
                          Verified Catalyst
                        </Badge>
                      )}
                      {data.availableForWork && (
                        <Badge variant="secondary">Open to work</Badge>
                      )}
                      {data.mentorOptIn && (
                        <Badge variant="outline" className="border-primary/30">
                          Mentor
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex gap-2 shrink-0 ml-auto items-center">
                  {isMe ? (
                    <Button asChild>
                      <Link href="/pro-networx/me">Edit profile</Link>
                    </Button>
                  ) : (
                    <>
                      {!blockStatus?.blockedByMe && (
                        <>
                          <Button
                            variant={following ? 'outline' : 'default'}
                            onClick={handleToggleFollow}
                            disabled={followBusy || following == null}
                            className={
                              following
                                ? 'inline-flex items-center gap-1'
                                : 'bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1'
                            }
                          >
                            {following ? (
                              <>
                                <UserCheck className="h-4 w-4" /> Following
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" /> Follow
                              </>
                            )}
                          </Button>
                          {data.messagingLocked ? (
                            <Button
                              variant="outline"
                              onClick={handleProSubscribe}
                              disabled={proCheckoutBusy}
                              className="inline-flex items-center gap-1"
                            >
                              <Lock className="h-4 w-4" />{' '}
                              {proCheckoutBusy ? 'Redirecting…' : 'Message'}
                            </Button>
                          ) : (
                            <Button asChild variant="outline">
                              <Link
                                href={`/messages?with=${data.userId}`}
                                className="inline-flex items-center gap-1"
                              >
                                <MessageSquare className="h-4 w-4" /> Message
                              </Link>
                            </Button>
                          )}
                        </>
                      )}
                      <UserSafetyMenu
                        userId={data.userId}
                        displayName={data.displayName}
                        blockedByMe={blockStatus?.blockedByMe}
                        onBlocked={() =>
                          setBlockStatus({ blockedByMe: true, blockedMe: false })
                        }
                        onUnblocked={() =>
                          setBlockStatus({ blockedByMe: false, blockedMe: false })
                        }
                      />
                    </>
                  )}
                  {data.resumeUrl ? (
                    <Button variant="outline" asChild>
                      <a
                        href={data.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1"
                      >
                        <FileText className="h-4 w-4" /> Resume
                      </a>
                    </Button>
                  ) : data.resumeLocked ? (
                    <Button
                      variant="outline"
                      onClick={handleProSubscribe}
                      disabled={proCheckoutBusy}
                      className="inline-flex items-center gap-1"
                    >
                      <Lock className="h-4 w-4" />{' '}
                      {proCheckoutBusy ? 'Redirecting…' : 'Resume'}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {!isMe && blockStatus?.blockedByMe && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="py-4 text-sm text-muted-foreground">
                You blocked {data.displayName || 'this user'}. Unblock them from
                the menu above or in Settings → Blocked accounts to see their
                profile and posts again.
              </CardContent>
            </Card>
          )}

          {(!blockStatus?.blockedByMe || isMe) && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {aboutText && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-3">
                    <h2 className="text-lg font-semibold text-foreground">About</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap">{aboutText}</p>
                  </CardContent>
                </Card>
              )}

              {data.skills.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-3">
                    <h2 className="text-lg font-semibold text-foreground">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="font-normal">
                          {s.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {featured.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Featured</h2>
                    <ul className="space-y-3">
                      {featured.map((f, i) => (
                        <li key={i}>
                          {f.url ? (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {f.title || f.url}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground">{f.title}</span>
                          )}
                          {f.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{f.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {experience.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-5">
                    <h2 className="text-lg font-semibold text-foreground">Experience</h2>
                    <ul className="space-y-5">
                      {experience.map((exp, i) => (
                        <li
                          key={i}
                          className="border-b border-border last:border-0 pb-5 last:pb-0"
                        >
                          <div className="font-semibold text-foreground">{exp.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {exp.company}
                            {exp.location && ` · ${exp.location}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {exp.startDate}
                            {exp.endDate || exp.current
                              ? ` – ${exp.current ? 'Present' : exp.endDate}`
                              : ''}
                          </div>
                          {exp.description && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                              {exp.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {education.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-5">
                    <h2 className="text-lg font-semibold text-foreground">Education</h2>
                    <ul className="space-y-5">
                      {education.map((edu, i) => (
                        <li
                          key={i}
                          className="border-b border-border last:border-0 pb-5 last:pb-0"
                        >
                          <div className="font-semibold text-foreground">{edu.school}</div>
                          <div className="text-sm text-muted-foreground">
                            {[edu.degree, edu.field].filter(Boolean).join(' · ')}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {edu.startYear}
                            {edu.endYear ? ` – ${edu.endYear}` : ''}
                          </div>
                          {edu.description && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                              {edu.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Instagram-style portfolio grid (Pro-Networx feed posts) */}
              <Card className="glass-panel border border-border">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Portfolio</h2>
                    <span className="text-xs text-muted-foreground">
                      {portfolioPosts.length} posts
                    </span>
                  </div>
                  {portfolioPosts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No posts yet. Posts on Pro-Networx show up here as a portfolio.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1 sm:gap-2">
                      {portfolioPosts.map((post) => (
                        <Link
                          key={post.id}
                          href={`/pro-networx/explore/${post.id}`}
                          className="relative aspect-square overflow-hidden rounded-md bg-muted group"
                        >
                          {post.mediaType === 'video' ? (
                            <video
                              src={post.imageUrl}
                              muted
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <Image
                              src={post.imageUrl}
                              alt={post.caption || 'Post'}
                              fill
                              sizes="(max-width: 640px) 33vw, 200px"
                              className="object-cover transition-transform duration-200 group-hover:scale-105"
                              unoptimized={shouldUnoptimize(post.imageUrl)}
                            />
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Legacy provider portfolio (audio / video / images) */}
              {(data.portfolio ?? []).length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Featured work</h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(data.portfolio ?? []).slice(0, 6).map((p) => (
                        <Card key={p.id} className="overflow-hidden border border-border bg-card">
                          <CardContent className="p-0">
                            {p.type === 'image' && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.fileUrl}
                                alt={p.title ?? 'Portfolio'}
                                className="w-full h-36 object-cover"
                              />
                            )}
                            {p.type === 'video' && (
                              <div className="w-full aspect-video bg-muted">
                                <video
                                  src={p.fileUrl}
                                  controls
                                  className="w-full h-full object-contain"
                                  title={p.title ?? 'Video'}
                                />
                              </div>
                            )}
                            {p.type === 'audio' && (
                              <audio controls src={p.fileUrl} className="w-full" />
                            )}
                            <div className="p-3 space-y-1">
                              {p.title && (
                                <p className="font-medium text-foreground text-sm">{p.title}</p>
                              )}
                              {p.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Side rail: Services + Resume + Social */}
            <div className="space-y-6">
              {data.resumeUrl ? (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-2">
                    <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Resume
                    </h2>
                    <a
                      href={data.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-primary hover:underline text-sm break-all"
                    >
                      {data.resumeFilename || 'View resume'}
                    </a>
                  </CardContent>
                </Card>
              ) : data.resumeLocked ? (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-2">
                    <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Resume
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Resumes include contact info. Subscribe to Pro-Networx to
                      open this creator&apos;s resume.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleProSubscribe}
                      disabled={proCheckoutBusy}
                    >
                      {proCheckoutBusy ? 'Redirecting…' : 'Subscribe to view'}
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="glass-panel border border-border sticky top-20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground inline-flex items-center gap-2">
                      <Briefcase className="h-4 w-4" /> Services
                    </h2>
                    <Badge variant="outline" className="border-primary/30 shrink-0">
                      {services.length}
                    </Badge>
                  </div>
                  {services.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No services listed.</p>
                  ) : (
                    <div className="space-y-3">
                      {services.map((l) => (
                        <Link
                          key={l.id}
                          href={`/pro-networx/services/${l.id}`}
                          className="block rounded-lg border border-border p-3 space-y-1 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex justify-between gap-2">
                            <p className="font-medium text-foreground text-sm truncate">
                              {l.title}
                            </p>
                            <span className="text-xs font-mono text-foreground shrink-0">
                              {formatPriceCents(l.priceCents, l.rateType)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">
                            {l.serviceType.replace(/_/g, ' ')}
                          </p>
                          {l.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {l.description}
                            </p>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  {!isMe && (
                    <div className="pt-4 border-t border-border space-y-2">
                      {data.messagingLocked ? (
                        <Button
                          onClick={handleProSubscribe}
                          disabled={proCheckoutBusy}
                          className="w-full bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1 justify-center"
                        >
                          <Lock className="h-4 w-4" />{' '}
                          {proCheckoutBusy ? 'Redirecting…' : 'Message'}
                        </Button>
                      ) : (
                        <Button
                          asChild
                          className="w-full bg-primary text-primary-foreground hover:opacity-90"
                        >
                          <Link
                            href={`/messages?with=${data.userId}`}
                            className="inline-flex items-center gap-1 justify-center"
                          >
                            <MessageSquare className="h-4 w-4" /> Message
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {socialLinks.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Social links</h2>
                    <div className="space-y-2">
                      {socialLinks.map((item) => (
                        <a
                          key={`${item.label}-${item.url}`}
                          href={item.url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-primary hover:underline text-sm break-all"
                        >
                          {item.label}: {item.url}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          )}

          <div className="mt-6 flex sm:hidden gap-2 items-center">
            {isMe ? (
              <Button asChild className="flex-1">
                <Link href="/pro-networx/me">Edit profile</Link>
              </Button>
            ) : (
              <>
                {!blockStatus?.blockedByMe && (
                  <>
                    <Button
                      variant={following ? 'outline' : 'default'}
                      onClick={handleToggleFollow}
                      disabled={followBusy || following == null}
                      className={
                        following
                          ? 'flex-1 inline-flex items-center justify-center gap-1'
                          : 'flex-1 bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-1'
                      }
                    >
                      {following ? (
                        <>
                          <UserCheck className="h-4 w-4" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" /> Follow
                        </>
                      )}
                    </Button>
                    {data.messagingLocked ? (
                      <Button
                        variant="outline"
                        className="flex-1 inline-flex items-center justify-center gap-1"
                        onClick={handleProSubscribe}
                        disabled={proCheckoutBusy}
                      >
                        <Lock className="h-4 w-4" />{' '}
                        {proCheckoutBusy ? 'Redirecting…' : 'Message'}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" className="flex-1">
                        <Link href={`/messages?with=${data.userId}`}>Message</Link>
                      </Button>
                    )}
                  </>
                )}
                <UserSafetyMenu
                  userId={data.userId}
                  displayName={data.displayName}
                  blockedByMe={blockStatus?.blockedByMe}
                  onBlocked={() =>
                    setBlockStatus({ blockedByMe: true, blockedMe: false })
                  }
                  onUnblocked={() =>
                    setBlockStatus({ blockedByMe: false, blockedMe: false })
                  }
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
