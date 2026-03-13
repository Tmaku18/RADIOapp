'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { artistFollowsApi, songsApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DiscographyPlayer, type DiscographyTrack } from '@/components/player/DiscographyPlayer';
import { usePlayback } from '@/components/playback';

type ArtistSong = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  audioUrl: string | null;
  artworkUrl: string | null;
  durationSeconds: number;
  playCount: number;
  profilePlayCount: number;
  likeCount: number;
  popularityScore: number;
  createdAt: string;
};

type ArtistProfileResponse = {
  artist: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    headline: string | null;
    role: string;
    socials: {
      instagramUrl: string | null;
      twitterUrl: string | null;
      youtubeUrl: string | null;
      tiktokUrl: string | null;
      websiteUrl: string | null;
    };
  };
  stats: {
    totalSongs: number;
    followerCount: number;
    monthlyListenerCount: number;
    totalPlayCount: number;
  };
  popularSongs: ArtistSong[];
  librarySongs: ArtistSong[];
};

type LegacyUserResponse = {
  id: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  headline?: string | null;
  role?: string;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  websiteUrl?: string | null;
};

function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n || 0);
}

function formatDuration(seconds: number) {
  const mins = Math.floor((seconds || 0) / 60);
  const secs = (seconds || 0) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function toDiscographyTrack(
  song: ArtistSong,
  likedMap: Record<string, boolean>,
): DiscographyTrack {
  return {
    id: song.id,
    title: song.title,
    artistName: song.artistName,
    artistId: song.artistId,
    audioUrl: song.audioUrl,
    artworkUrl: song.artworkUrl,
    durationSeconds: song.durationSeconds,
    likeCount: song.likeCount,
    liked: likedMap[song.id] ?? false,
  };
}

export function ArtistPageView({
  artistId,
  mode,
}: {
  artistId: string;
  mode: 'dashboard' | 'public';
}) {
  const { profile } = useAuth();
  const { actions } = usePlayback();
  const [data, setData] = useState<ArtistProfileResponse | null>(null);
  const [likedBySongId, setLikedBySongId] = useState<Record<string, boolean>>({});
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.getArtistProfile(artistId);
        if (ignore) return;
        setData(res.data as ArtistProfileResponse);
      } catch {
        // Compatibility fallback: if aggregate endpoint fails in a not-yet-migrated env,
        // hydrate from legacy endpoints instead of hard-failing the page.
        try {
          const [userRes, songsRes] = await Promise.all([
            usersApi.getById(artistId),
            songsApi.getAll({ artistId, status: 'approved', limit: 300 }),
          ]);
          if (ignore) return;
          const user = userRes.data as LegacyUserResponse;
          const songRows = (Array.isArray(songsRes.data) ? songsRes.data : []) as Array<{
            id: string;
            title: string;
            artist_id: string;
            artist_name: string;
            audio_url: string | null;
            artwork_url: string | null;
            duration_seconds?: number;
            play_count?: number;
            profile_play_count?: number;
            like_count?: number;
            created_at: string;
          }>;
          const mappedSongs: ArtistSong[] = songRows.map((song) => {
            const playCount = song.play_count || 0;
            const profilePlayCount = song.profile_play_count || 0;
            const likeCount = song.like_count || 0;
            return {
              id: song.id,
              title: song.title,
              artistId: song.artist_id,
              artistName: song.artist_name,
              audioUrl: song.audio_url,
              artworkUrl: song.artwork_url,
              durationSeconds: song.duration_seconds || 0,
              playCount,
              profilePlayCount,
              likeCount,
              popularityScore: playCount + profilePlayCount + likeCount * 3,
              createdAt: song.created_at,
            };
          });
          const totalPlayCount = mappedSongs.reduce(
            (sum, song) => sum + song.playCount + song.profilePlayCount,
            0,
          );
          setData({
            artist: {
              id: user.id,
              displayName: user.displayName ?? null,
              avatarUrl: user.avatarUrl ?? null,
              bio: user.bio ?? null,
              headline: user.headline ?? null,
              role: user.role ?? 'artist',
              socials: {
                instagramUrl: user.instagramUrl ?? null,
                twitterUrl: user.twitterUrl ?? null,
                youtubeUrl: user.youtubeUrl ?? null,
                tiktokUrl: user.tiktokUrl ?? null,
                websiteUrl: user.websiteUrl ?? null,
              },
            },
            stats: {
              totalSongs: mappedSongs.length,
              followerCount: 0,
              monthlyListenerCount: 0,
              totalPlayCount,
            },
            popularSongs: [...mappedSongs]
              .sort((a, b) => b.popularityScore - a.popularityScore)
              .slice(0, 10),
            librarySongs: mappedSongs,
          });
        } catch {
          if (!ignore) setError('Unable to load artist page.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [artistId]);

  useEffect(() => {
    if (!data?.librarySongs?.length || !profile?.id) return;
    let cancelled = false;
    (async () => {
      const entries: Array<[string, boolean]> = [];
      for (const song of data.librarySongs) {
        try {
          const res = await songsApi.getLikeStatus(song.id);
          entries.push([song.id, !!res.data?.liked]);
        } catch {
          entries.push([song.id, false]);
        }
      }
      if (!cancelled) setLikedBySongId(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [data?.librarySongs, profile?.id]);

  useEffect(() => {
    if (!profile?.id || !data?.artist?.id || profile.id === data.artist.id) return;
    let ignore = false;
    artistFollowsApi
      .isFollowing(data.artist.id)
      .then((res) => {
        if (!ignore) setFollowing(!!res.data?.following);
      })
      .catch(() => {
        if (!ignore) setFollowing(false);
      });
    return () => {
      ignore = true;
    };
  }, [profile?.id, data?.artist?.id]);

  const tracks = useMemo(
    () =>
      (data?.librarySongs ?? []).map((song) => toDiscographyTrack(song, likedBySongId)),
    [data?.librarySongs, likedBySongId],
  );

  const handleToggleLike = async (songId: string, nextLiked: boolean) => {
    if (!profile?.id) return;
    if (nextLiked) await songsApi.like(songId);
    else await songsApi.unlike(songId);
    setLikedBySongId((prev) => ({ ...prev, [songId]: nextLiked }));
  };

  const handleRecordListen = async (songId: string) => {
    try {
      await songsApi.recordProfileListen(songId);
    } catch {
      // Best effort; do not break playback UX.
    }
  };

  const handlePlayPopular = async (song: ArtistSong) => {
    if (!song.audioUrl) return;
    actions.loadTrack(
      {
        id: song.id,
        title: song.title,
        artistName: song.artistName,
        artistId: song.artistId,
        artworkUrl: song.artworkUrl,
        audioUrl: song.audioUrl,
        durationSeconds: song.durationSeconds,
      },
      'discography',
    );
    await actions.play();
  };

  const toggleFollow = async () => {
    if (!data?.artist?.id || !profile?.id || profile.id === data.artist.id) return;
    setFollowLoading(true);
    try {
      if (following) {
        await artistFollowsApi.unfollow(data.artist.id);
        setFollowing(false);
      } else {
        await artistFollowsApi.follow(data.artist.id);
        setFollowing(true);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading artist page...</div>;
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">{error ?? 'Artist not found.'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl overflow-hidden bg-gradient-to-b from-primary/40 to-card border border-border">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            <Avatar className="h-28 w-28 ring-2 ring-background/60">
              <AvatarImage src={data.artist.avatarUrl ?? undefined} />
              <AvatarFallback className="text-3xl">
                {(data.artist.displayName || 'A')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Artist
              </p>
              <h1 className="text-4xl md:text-6xl font-black text-foreground truncate">
                {data.artist.displayName || 'Artist'}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {formatNumber(data.stats.monthlyListenerCount)} monthly listeners
              </p>
              {data.artist.headline && (
                <p className="text-sm text-muted-foreground mt-1">{data.artist.headline}</p>
              )}
            </div>
            <div className="md:ml-auto flex items-center gap-2">
              {profile?.id && profile.id !== data.artist.id && mode === 'dashboard' && (
                <Button variant={following ? 'secondary' : 'default'} onClick={toggleFollow} disabled={followLoading}>
                  {followLoading ? '...' : following ? 'Following' : 'Follow'}
                </Button>
              )}
              {mode === 'dashboard' ? (
                <Link href="/listen"><Button variant="outline">Back to Radio</Button></Link>
              ) : (
                <Link href="/"><Button variant="outline">Back Home</Button></Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Followers</p><p className="text-xl font-bold">{formatNumber(data.stats.followerCount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total plays</p><p className="text-xl font-bold">{formatNumber(data.stats.totalPlayCount)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Songs</p><p className="text-xl font-bold">{formatNumber(data.stats.totalSongs)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Monthly listeners</p><p className="text-xl font-bold">{formatNumber(data.stats.monthlyListenerCount)}</p></CardContent></Card>
      </div>

      {data.artist.bio && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-2">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.artist.bio}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-xl mb-4">Popular</h2>
          <div className="space-y-2">
            {data.popularSongs.slice(0, 8).map((song, idx) => (
              <div key={song.id} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/40">
                <span className="text-sm text-muted-foreground">{idx + 1}</span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(song.playCount + song.profilePlayCount)} plays</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDuration(song.durationSeconds)}</span>
                <Button size="sm" onClick={() => void handlePlayPopular(song)} disabled={!song.audioUrl}>Play</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="font-semibold text-xl mb-4">Discography</h2>
          {tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved songs yet.</p>
          ) : (
            <DiscographyPlayer
              tracks={tracks}
              onToggleLike={handleToggleLike}
              onRecordListen={handleRecordListen}
            />
          )}
        </CardContent>
      </Card>

      {(data.artist.socials.instagramUrl ||
        data.artist.socials.twitterUrl ||
        data.artist.socials.youtubeUrl ||
        data.artist.socials.tiktokUrl ||
        data.artist.socials.websiteUrl) && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="font-semibold mb-3">Social links</h2>
            <div className="flex flex-wrap gap-3">
              {data.artist.socials.instagramUrl && <a className="text-sm underline text-primary" href={data.artist.socials.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
              {data.artist.socials.twitterUrl && <a className="text-sm underline text-primary" href={data.artist.socials.twitterUrl} target="_blank" rel="noreferrer">X</a>}
              {data.artist.socials.youtubeUrl && <a className="text-sm underline text-primary" href={data.artist.socials.youtubeUrl} target="_blank" rel="noreferrer">YouTube</a>}
              {data.artist.socials.tiktokUrl && <a className="text-sm underline text-primary" href={data.artist.socials.tiktokUrl} target="_blank" rel="noreferrer">TikTok</a>}
              {data.artist.socials.websiteUrl && <a className="text-sm underline text-primary" href={data.artist.socials.websiteUrl} target="_blank" rel="noreferrer">Website</a>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

