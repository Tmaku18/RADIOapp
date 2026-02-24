'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usersApi, songsApi, spotlightApi, liveServicesApi, artistFollowsApi, serviceProvidersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscographyPlayer, type DiscographyTrack } from '@/components/player/DiscographyPlayer';

type SongRow = {
  id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  audio_url: string | null;
  artwork_url: string | null;
  duration_seconds?: number;
  status: string;
  like_count?: number;
};

type ProviderProfile = {
  userId: string;
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  bio: string | null;
  locationRegion: string | null;
  role: 'service_provider';
  serviceTypes: string[];
  heroImageUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  mentorOptIn?: boolean;
  listings: Array<{
    id: string;
    serviceType: string;
    title: string;
    description: string | null;
    rateCents: number | null;
    rateType: 'hourly' | 'fixed';
    status: 'active' | 'paused';
    createdAt: string;
    updatedAt: string;
  }>;
  portfolio: Array<{
    id: string;
    type: 'image' | 'audio' | 'video';
    fileUrl: string;
    title: string | null;
    description: string | null;
    sortOrder: number;
    createdAt: string;
  }>;
};

function formatRate(rateCents: number | null, rateType: 'hourly' | 'fixed'): string {
  if (rateCents == null) return 'Contact for pricing';
  const dollars = (rateCents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

export default function ArtistProfilePage() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const artistId = typeof params?.id === 'string' ? params.id : '';
  const [artist, setArtist] = useState<{
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    role: string;
  } | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlimitedBySong, setUnlimitedBySong] = useState<Record<string, { allowed: boolean; context?: string }>>({});
  const [liveServices, setLiveServices] = useState<Array<{ id: string; title: string; description?: string | null; type: string; scheduledAt?: string | null; linkOrPlace?: string | null }>>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likedBySongId, setLikedBySongId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!artistId) return;
      setLoading(true);
      setError(null);
      setProviderProfile(null);
      try {
        const userRes = await usersApi.getById(artistId);
        if (ignore) return;
        const userData = userRes.data;

        if (userData.role === 'service_provider') {
          // Provider profile (LinkedIn-style)
          const provRes = await serviceProvidersApi.getByUserId(artistId);
          if (ignore) return;
          setProviderProfile(provRes.data as ProviderProfile);
          setArtist({
            id: userData.id,
            displayName: userData.displayName ?? null,
            avatarUrl: userData.avatarUrl ?? null,
            bio: userData.bio ?? null,
            role: userData.role,
          });
          setSongs([]);
          return;
        }

        if (userData.role !== 'artist' && userData.role !== 'admin') {
          setError('This profile is not an artist or service provider.');
          setArtist(null);
          setSongs([]);
          return;
        }

        const songsRes = await songsApi.getAll({ artistId, status: 'approved', limit: 200 });
        const songsData = songsRes.data || [];
        if (ignore) return;

        setArtist({
          id: userData.id,
          displayName: userData.displayName ?? null,
          avatarUrl: userData.avatarUrl ?? null,
          bio: userData.bio ?? null,
          role: userData.role,
        });
        setSongs(Array.isArray(songsData) ? songsData : []);
      } catch (e) {
        if (!ignore) {
          setError('Artist not found or unable to load.');
          setArtist(null);
          setProviderProfile(null);
          setSongs([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [artistId]);

  useEffect(() => {
    if (!artistId || !artist) return;
    if (artist.role === 'service_provider') return;
    let ignore = false;
    liveServicesApi.listByArtist(artistId).then((res) => {
      if (!ignore) setLiveServices(res.data || []);
    }).catch(() => { if (!ignore) setLiveServices([]); });
    return () => { ignore = true; };
  }, [artistId, artist]);

  useEffect(() => {
    if (!artistId || !profile?.id || profile.id === artistId) return;
    if (artist?.role === 'service_provider') return;
    let ignore = false;
    artistFollowsApi.isFollowing(artistId).then((res) => {
      if (!ignore) setFollowing(res.data?.following ?? false);
    }).catch(() => { if (!ignore) setFollowing(false); });
    return () => { ignore = true; };
  }, [artistId, profile?.id]);

  const handleFollowToggle = async () => {
    if (!artistId || profile?.id === artistId || followLoading) return;
    if (artist?.role === 'service_provider') return;
    setFollowLoading(true);
    try {
      if (following) {
        await artistFollowsApi.unfollow(artistId);
        setFollowing(false);
      } else {
        await artistFollowsApi.follow(artistId);
        setFollowing(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFollowLoading(false);
    }
  };

  // Check unlimited listening for each song
  useEffect(() => {
    if (!artistId || songs.length === 0 || !profile) return;
    if (artist?.role === 'service_provider') return;
    const map: Record<string, { allowed: boolean; context?: string }> = {};
    let cancelled = false;
    (async () => {
      for (const song of songs) {
        if (cancelled) break;
        try {
          const res = await spotlightApi.canListenUnlimited(artistId, song.id);
          map[song.id] = res.data ?? { allowed: false };
        } catch {
          map[song.id] = { allowed: false };
        }
      }
      if (!cancelled) setUnlimitedBySong((prev) => ({ ...prev, ...map }));
    })();
    return () => {
      cancelled = true;
    };
  }, [artistId, songs, profile]);

  // Load per-song like status for logged-in listeners (best-effort)
  useEffect(() => {
    if (!profile?.id) return;
    if (!artistId) return;
    if (songs.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: Array<[string, boolean]> = [];
      for (const s of songs) {
        try {
          const res = await songsApi.getLikeStatus(s.id);
          entries.push([s.id, !!res.data?.liked]);
        } catch {
          entries.push([s.id, false]);
        }
      }
      if (cancelled) return;
      setLikedBySongId(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [artistId, profile?.id, songs]);

  const discographyTracks: DiscographyTrack[] = useMemo(() => {
    return songs.map((s) => ({
      id: s.id,
      title: s.title,
      artistName: s.artist_name,
      artistId: s.artist_id,
      audioUrl: s.audio_url,
      artworkUrl: s.artwork_url,
      durationSeconds: s.duration_seconds ?? null,
      likeCount: s.like_count ?? null,
      liked: likedBySongId[s.id] ?? false,
    }));
  }, [songs, likedBySongId]);

  const handleToggleLike = async (songId: string, nextLiked: boolean) => {
    if (!profile?.id) return;
    if (nextLiked) {
      await songsApi.like(songId);
      setLikedBySongId((prev) => ({ ...prev, [songId]: true }));
    } else {
      await songsApi.unlike(songId);
      setLikedBySongId((prev) => ({ ...prev, [songId]: false }));
    }
  };

  const handleRecordListen = async (songId: string) => {
    // Record profile listen (combined popularity signal)
    try {
      await songsApi.recordProfileListen(songId);
    } catch {
      // Don't break playback UX
    }

    // If this song is currently in spotlight, record spotlight listen once per page load.
    const info = unlimitedBySong[songId];
    const isUnlimited = info?.allowed && info?.context;
    if (isUnlimited && profile?.id) {
      const key = `spotlight:${artistId}:${songId}`;
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(key) !== '1') {
        try {
          await spotlightApi.recordListen({
            songId,
            artistId: artistId,
            context: info.context as 'featured_replay' | 'artist_of_week' | 'artist_of_month',
          });
          window.sessionStorage.setItem(key, '1');
        } catch {
          // ignore
        }
      }
    }
  };

  if (!artistId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Invalid artist.</p>
        <Link href="/competition"><Button variant="outline">Back to Competition</Button></Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">{error ?? 'Artist not found.'}</p>
        <Link href="/competition"><Button variant="outline">Back to Competition</Button></Link>
      </div>
    );
  }

  if (providerProfile) {
    const isSelf = profile?.id === providerProfile.userId;
    const heroUrl = providerProfile.heroImageUrl ?? providerProfile.portfolio?.find((x) => x.type === 'image')?.fileUrl ?? null;
    return (
      <div className="space-y-8">
        {/* Hero + location (Industry Catalyst profile) */}
        {heroUrl && (
          <div className="relative w-full aspect-[21/9] max-h-64 rounded-xl overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" className="w-full h-full object-cover" />
            {providerProfile.locationRegion && (
              <span className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-background/80 text-sm text-foreground">
                📍 {providerProfile.locationRegion}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={providerProfile.avatarUrl ?? undefined} alt={providerProfile.displayName ?? 'Provider'} />
              <AvatarFallback className="text-2xl">{(providerProfile.displayName || 'P')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{providerProfile.displayName ?? 'Service provider'}</h1>
                {providerProfile.mentorOptIn && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-medium ring-1 ring-primary/40" title="Mentor">
                    <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                    Mentor
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Badge variant="secondary">Industry Catalyst</Badge>
                {!heroUrl && providerProfile.locationRegion && (
                  <span className="text-sm text-muted-foreground">📍 {providerProfile.locationRegion}</span>
                )}
              </div>
              {providerProfile.headline && (
                <p className="text-muted-foreground mt-1">{providerProfile.headline}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isSelf && (
              <Button asChild size="default">
                <Link href={`/messages?with=${providerProfile.userId}`}>Message</Link>
              </Button>
            )}
            <Link href="/discover">
              <Button variant="outline" size="sm">Back to Discover</Button>
            </Link>
          </div>
        </div>

        {providerProfile.bio && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{providerProfile.bio}</p>
            </CardContent>
          </Card>
        )}

        {providerProfile.serviceTypes?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Services</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {providerProfile.serviceTypes.map((st) => (
                <Badge key={st} variant="outline">{st}</Badge>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service menu</CardTitle>
          </CardHeader>
          <CardContent>
            {providerProfile.listings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No listings yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Service</th>
                      <th className="text-left py-2 font-medium hidden sm:table-cell">Description</th>
                      <th className="text-right py-2 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerProfile.listings.map((l) => (
                      <tr key={l.id} className="border-b border-border/50">
                        <td className="py-3">
                          <p className="font-medium">{l.title}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{l.serviceType}</p>
                        </td>
                        <td className="py-3 text-muted-foreground hidden sm:table-cell">{l.description ?? '—'}</td>
                        <td className="py-3 text-right font-medium">{formatRate(l.rateCents, l.rateType)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            {providerProfile.portfolio.length === 0 ? (
              <p className="text-sm text-muted-foreground">No portfolio items yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {providerProfile.portfolio.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
                    <Badge variant="outline" className="capitalize">{p.type}</Badge>
                    {p.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fileUrl} alt={p.title ?? 'Portfolio'} className="w-full h-40 object-cover rounded-md" />
                    )}
                    {p.type === 'video' && (
                      <div className="w-full aspect-video rounded-md overflow-hidden bg-muted">
                        <video src={p.fileUrl} controls className="w-full h-full object-contain" title={p.title ?? 'Video'} />
                      </div>
                    )}
                    {p.type === 'audio' && (
                      <audio controls src={p.fileUrl} className="w-full" />
                    )}
                    {p.title && <p className="font-medium">{p.title}</p>}
                    {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {(providerProfile.instagramUrl || providerProfile.linkedinUrl || providerProfile.portfolioUrl) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connect</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {providerProfile.instagramUrl && (
                <a href={providerProfile.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Instagram
                </a>
              )}
              {providerProfile.linkedinUrl && (
                <a href={providerProfile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  LinkedIn
                </a>
              )}
              {providerProfile.portfolioUrl && (
                <a href={providerProfile.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Portfolio
                </a>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={artist.avatarUrl ?? undefined} alt={artist.displayName ?? 'Artist'} />
            <AvatarFallback className="text-2xl">{(artist.displayName || 'A')[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{artist.displayName ?? 'Artist'}</h1>
            <p className="text-muted-foreground">Artist profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile?.id && profile.id !== artistId && (
            <Button variant={following ? 'secondary' : 'default'} size="sm" onClick={handleFollowToggle} disabled={followLoading}>
              {followLoading ? '…' : following ? 'Unfollow' : 'Follow'}
            </Button>
          )}
          <Link href="/competition">
            <Button variant="outline" size="sm">Back to Competition</Button>
          </Link>
        </div>
      </div>

      {liveServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming live</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {liveServices.map((ev) => (
                <li key={ev.id} className="flex flex-col gap-1 p-2 rounded-lg border border-border">
                  <span className="font-medium">{ev.title}</span>
                  {ev.scheduledAt && (
                    <span className="text-sm text-muted-foreground">
                      {new Date(ev.scheduledAt).toLocaleString()}
                    </span>
                  )}
                  {ev.linkOrPlace && (
                    <a href={ev.linkOrPlace} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      {ev.linkOrPlace}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {artist.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{artist.bio}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Songs</CardTitle>
          <p className="text-sm text-muted-foreground">
            Unlimited discography playback. Likes here affect the leaderboard; listens contribute to discovery ranking.
          </p>
        </CardHeader>
        <CardContent>
          {songs.length === 0 ? (
            <p className="text-muted-foreground">No approved songs yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {songs.some((s) => unlimitedBySong[s.id]?.allowed && unlimitedBySong[s.id]?.context) ? (
                  <Badge variant="secondary">Spotlight: unlimited listens active</Badge>
                ) : (
                  <Badge variant="outline">Spotlight: none today</Badge>
                )}
                <Badge variant="outline">Spotify-style player</Badge>
              </div>

              <DiscographyPlayer
                tracks={discographyTracks}
                onToggleLike={handleToggleLike}
                onRecordListen={handleRecordListen}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Link href="/listen">
          <Button>Listen to radio</Button>
        </Link>
        <Link href="/competition">
          <Button variant="outline">Competition & Spotlight</Button>
        </Link>
      </div>
    </div>
  );
}
