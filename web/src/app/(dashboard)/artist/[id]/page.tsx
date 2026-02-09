'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usersApi, songsApi, spotlightApi, liveServicesApi, artistFollowsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type SongRow = {
  id: string;
  title: string;
  artist_name: string;
  artist_id: string;
  audio_url: string | null;
  artwork_url: string | null;
  duration_seconds?: number;
  status: string;
};

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
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlimitedBySong, setUnlimitedBySong] = useState<Record<string, { allowed: boolean; context?: string }>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordedListen, setRecordedListen] = useState<Set<string>>(new Set());
  const [liveServices, setLiveServices] = useState<Array<{ id: string; title: string; description?: string | null; type: string; scheduledAt?: string | null; linkOrPlace?: string | null }>>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!artistId) return;
      setLoading(true);
      setError(null);
      try {
        const [userRes, songsRes] = await Promise.all([
          usersApi.getById(artistId),
          songsApi.getAll({ artistId, status: 'approved', limit: 50 }),
        ]);
        if (ignore) return;
        const userData = userRes.data;
        const songsData = songsRes.data || [];
        if (userData.role !== 'artist' && userData.role !== 'admin') {
          setError('This profile is not an artist.');
          setArtist(null);
          setSongs([]);
          return;
        }
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
    let ignore = false;
    liveServicesApi.listByArtist(artistId).then((res) => {
      if (!ignore) setLiveServices(res.data || []);
    }).catch(() => { if (!ignore) setLiveServices([]); });
    return () => { ignore = true; };
  }, [artistId, artist]);

  useEffect(() => {
    if (!artistId || !profile?.id || profile.id === artistId) return;
    let ignore = false;
    artistFollowsApi.isFollowing(artistId).then((res) => {
      if (!ignore) setFollowing(res.data?.following ?? false);
    }).catch(() => { if (!ignore) setFollowing(false); });
    return () => { ignore = true; };
  }, [artistId, profile?.id]);

  const handleFollowToggle = async () => {
    if (!artistId || profile?.id === artistId || followLoading) return;
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

  const handlePlay = useCallback(
    async (song: SongRow) => {
      const audioUrl = song.audio_url;
      if (!audioUrl?.trim()) return;

      const info = unlimitedBySong[song.id];
      const isUnlimited = info?.allowed && info?.context;

      if (isUnlimited && profile && !recordedListen.has(song.id)) {
        try {
          await spotlightApi.recordListen({
            songId: song.id,
            artistId: artistId,
            context: info.context as 'featured_replay' | 'artist_of_week' | 'artist_of_month',
          });
          setRecordedListen((prev) => new Set(prev).add(song.id));
        } catch (e) {
          console.error('Failed to record spotlight listen', e);
        }
      }

      if (audioRef.current) {
        if (playingId === song.id) {
          audioRef.current.pause();
          setPlayingId(null);
          return;
        }
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
        setPlayingId(song.id);
      }
    },
    [artistId, profile, unlimitedBySong, recordedListen, playingId],
  );

  useEffect(() => {
    const el = typeof document !== 'undefined' ? document.createElement('audio') : null;
    if (el) {
      const onEnded = () => setPlayingId(null);
      el.addEventListener('ended', onEnded);
      audioRef.current = el;
      return () => {
        el.removeEventListener('ended', onEnded);
        el.pause();
        audioRef.current = null;
      };
    }
  }, []);

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
            Spotlight tracks can be played unlimited times here and count toward the listens leaderboard.
          </p>
        </CardHeader>
        <CardContent>
          {songs.length === 0 ? (
            <p className="text-muted-foreground">No approved songs yet.</p>
          ) : (
            <ul className="space-y-2">
              {songs.map((song) => {
                const unlimited = unlimitedBySong[song.id];
                const canPlayUnlimited = unlimited?.allowed && unlimited?.context;
                return (
                  <li
                    key={song.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50"
                  >
                    {song.artwork_url && (
                      <img
                        src={song.artwork_url}
                        alt=""
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                        aria-hidden
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{song.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{song.artist_name}</p>
                    </div>
                    {canPlayUnlimited && (
                      <Badge variant="secondary" className="flex-shrink-0">
                        Unlimited listens
                      </Badge>
                    )}
                    <Button
                      variant={playingId === song.id ? 'secondary' : 'default'}
                      size="sm"
                      onClick={() => handlePlay(song)}
                      disabled={!song.audio_url}
                    >
                      {playingId === song.id ? 'Pause' : 'Play'}
                    </Button>
                  </li>
                );
              })}
            </ul>
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
