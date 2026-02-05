'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { leaderboardApi, feedApi, spotlightApi, competitionApi, suggestionsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface LeaderboardSong {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artworkUrl: string | null;
  likeCount?: number;
  spotlightListenCount?: number;
}

interface NewsItem {
  id: string;
  type: string;
  title: string;
  bodyOrDescription: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  createdAt: string;
}

export default function CompetitionPage() {
  const { profile } = useAuth();
  const [leaderboardLikes, setLeaderboardLikes] = useState<LeaderboardSong[]>([]);
  const [leaderboardListens, setLeaderboardListens] = useState<LeaderboardSong[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [todaySpotlight, setTodaySpotlight] = useState<{ artistId: string; artistName: string; songId: string | null; songTitle: string | null } | null>(null);
  const [weekSpotlight, setWeekSpotlight] = useState<Array<{ date: string; artistId: string; artistName: string }>>([]);
  const [currentWeek, setCurrentWeek] = useState<{ periodStart: string; periodEnd: string; votingOpen: boolean } | null>(null);
  const [localArtists, setLocalArtists] = useState<Array<{ id: string; displayName: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [voteSongIds, setVoteSongIds] = useState<string[]>([]);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [likesRes, listensRes, feedRes, todayRes, weekRes, weekInfoRes] = await Promise.all([
          leaderboardApi.getSongs({ by: 'likes', limit: 20 }),
          leaderboardApi.getSongs({ by: 'listens', limit: 20 }),
          feedApi.getNewsPromotions(10),
          spotlightApi.getToday(),
          spotlightApi.getWeek(),
          competitionApi.getCurrentWeek(),
        ]);
        if (ignore) return;
        setLeaderboardLikes(likesRes.data || []);
        setLeaderboardListens(listensRes.data || []);
        setNews(feedRes.data || []);
        setTodaySpotlight(todayRes.data || null);
        setWeekSpotlight(weekRes.data || []);
        setCurrentWeek(weekInfoRes.data || null);
        if (profile?.suggestLocalArtists !== false && profile?.region) {
          try {
            const local = await suggestionsApi.getLocalArtists(5);
            if (!ignore) setLocalArtists(local.data?.artists || []);
          } catch {
            if (!ignore) setLocalArtists([]);
          }
        }
      } catch (e) {
        if (!ignore) console.error('Competition load error', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (profile !== undefined) load();
    return () => {
      ignore = true;
    };
  }, [profile?.id, profile?.suggestLocalArtists, profile?.region]);

  const handleVote = async () => {
    if (voteSongIds.length !== 7) {
      setVoteError('Select exactly 7 songs (rank 1–7).');
      return;
    }
    setVoteError(null);
    setVoteSubmitting(true);
    try {
      await competitionApi.vote(voteSongIds);
      setVoteSongIds([]);
    } catch (e: unknown) {
      setVoteError(e instanceof Error ? e.message : 'Vote failed');
    } finally {
      setVoteSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Competition & Spotlight</h1>
          <p className="text-muted-foreground mt-1">Leaderboards, featured artists, and vote for Top 7</p>
        </div>
      </div>

      {news.length > 0 && (
        <Card className="overflow-hidden border-primary/20 bg-primary/5">
          <div className="flex items-center gap-4 py-2 px-4 overflow-x-auto animate-in fade-in duration-500">
            {news.map((n) => (
              <div key={n.id} className="flex-shrink-0 flex items-center gap-2">
                <Badge variant={n.type === 'promotion' ? 'default' : 'secondary'}>{n.type}</Badge>
                <span className="text-sm font-medium">{n.title}</span>
                {n.linkUrl && (
                  <a href={n.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                    Learn more
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {localArtists.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Artists in your area</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {localArtists.map((a) => (
                <Link key={a.id} href={`/artist/${a.id}`}>
                  <Badge variant="outline" className="py-2 px-3">{a.displayName || 'Artist'}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Spotlight</CardTitle>
            {currentWeek && (
              <p className="text-sm text-muted-foreground">
                Week {currentWeek.periodStart} – {currentWeek.periodEnd} · Voting {currentWeek.votingOpen ? 'open' : 'closed'}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : todaySpotlight ? (
              <div className="flex items-center gap-4">
                <div className="text-4xl">🎤</div>
                <div>
                  <p className="font-semibold">{todaySpotlight.artistName}</p>
                  {todaySpotlight.songTitle && <p className="text-sm text-muted-foreground">{todaySpotlight.songTitle}</p>}
                  <Link href={`/artist/${todaySpotlight.artistId}`}>
                    <Button variant="outline" size="sm" className="mt-2">View artist</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No spotlight set for today.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This week&apos;s lineup</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : weekSpotlight.length > 0 ? (
              <ul className="space-y-2">
                {weekSpotlight.map((d) => (
                  <li key={d.date} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{d.date}</span>
                    <Link href={`/artist/${d.artistId}`} className="font-medium hover:underline">{d.artistName}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No lineup for this week yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboards</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="likes" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="likes">By likes</TabsTrigger>
              <TabsTrigger value="listens">By listens</TabsTrigger>
            </TabsList>
            <TabsContent value="likes" className="mt-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ul className="space-y-2">
                  {leaderboardLikes.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <span className="w-6 text-muted-foreground font-mono">{i + 1}</span>
                      {s.artworkUrl && <img src={s.artworkUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{s.artistName}</p>
                      </div>
                      <Badge variant="secondary">{s.likeCount ?? 0} likes</Badge>
                    </li>
                  ))}
                  {!loading && leaderboardLikes.length === 0 && <p className="text-muted-foreground">No data yet.</p>}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="listens" className="mt-4">
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ul className="space-y-2">
                  {leaderboardListens.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <span className="w-6 text-muted-foreground font-mono">{i + 1}</span>
                      {s.artworkUrl && <img src={s.artworkUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{s.artistName}</p>
                      </div>
                      <Badge variant="secondary">{s.spotlightListenCount ?? 0} listens</Badge>
                    </li>
                  ))}
                  {!loading && leaderboardListens.length === 0 && <p className="text-muted-foreground">No data yet.</p>}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {currentWeek?.votingOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Vote for Top 7</CardTitle>
            <p className="text-sm text-muted-foreground">Pick 7 songs and rank them 1–7. Voting closes at end of week.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Select 7 songs from approved tracks (e.g. from Listen or Songs). Paste or type song IDs below (comma-separated) as your rank 1–7:</p>
            <input
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="song-id-1, song-id-2, ..."
              value={voteSongIds.join(', ')}
              onChange={(e) => setVoteSongIds(e.target.value.split(/[\s,]+/).filter(Boolean))}
            />
            {voteError && <p className="text-destructive text-sm mt-2">{voteError}</p>}
            <Button onClick={handleVote} disabled={voteSubmitting || voteSongIds.length !== 7} className="mt-4">
              {voteSubmitting ? 'Submitting…' : 'Submit vote'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4">
        <Link href="/listen">
          <Button>Listen now</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
