'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { refineryApi, prospectorApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RefinerySong = {
  id: string;
  title: string;
  artist_name: string;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  users?: { display_name: string | null } | null;
};

export default function RefineryPage() {
  const { profile } = useAuth();
  const isProspector = profile?.role === 'listener' || profile?.role === 'artist' || profile?.role === 'admin';

  const [songs, setSongs] = useState<RefinerySong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [rankBySong, setRankBySong] = useState<Record<string, number>>({});
  const [surveyBySong, setSurveyBySong] = useState<Record<string, { genre?: string; mood?: string; wouldPlay?: string }>>({});
  const [commentsBySong, setCommentsBySong] = useState<Record<string, Comment[]>>({});
  const [newCommentBySong, setNewCommentBySong] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, string>>({}); // songId -> 'rank'|'survey'|'comment'

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await refineryApi.listSongs();
      const data = res.data as { songs: RefinerySong[] };
      setSongs(data?.songs ?? []);
    } catch {
      setError('Failed to load The Refinery.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (songId: string) => {
    try {
      const res = await refineryApi.getComments(songId);
      const data = res.data as { comments: Comment[] };
      setCommentsBySong((prev) => ({ ...prev, [songId]: data?.comments ?? [] }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isProspector) loadSongs();
  }, [isProspector, loadSongs]);

  const handlePlay = (song: RefinerySong) => {
    if (playingId === song.id) {
      setPlayingId(null);
      return;
    }
    setPlayingId(song.id);
    const audio = document.getElementById(`refinery-audio-${song.id}`) as HTMLAudioElement;
    if (audio) {
      audio.src = song.audio_url;
      audio.play().catch(() => setPlayingId(null));
    }
  };

  const submitRank = async (songId: string) => {
    const score = rankBySong[songId];
    if (score == null || score < 1 || score > 10) return;
    setSubmitting((s) => ({ ...s, [songId]: 'rank' }));
    try {
      await prospectorApi.submitRefinement({ songId, score });
      setSubmitting((s) => ({ ...s, [songId]: '' }));
    } catch {
      setSubmitting((s) => ({ ...s, [songId]: '' }));
    }
  };

  const submitSurvey = async (songId: string) => {
    const survey = surveyBySong[songId];
    if (!survey) return;
    setSubmitting((s) => ({ ...s, [songId]: 'survey' }));
    try {
      await prospectorApi.submitSurvey({ songId, responses: survey });
      setSubmitting((s) => ({ ...s, [songId]: '' }));
    } catch {
      setSubmitting((s) => ({ ...s, [songId]: '' }));
    }
  };

  const submitComment = async (songId: string) => {
    const body = (newCommentBySong[songId] ?? '').trim();
    if (!body) return;
    setSubmitting((s) => ({ ...s, [songId]: 'comment' }));
    try {
      await refineryApi.addComment(songId, body);
      setNewCommentBySong((s) => ({ ...s, [songId]: '' }));
      await loadComments(songId);
    } catch {
      // ignore
    } finally {
      setSubmitting((s) => ({ ...s, [songId]: '' }));
    }
  };

  if (!isProspector) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The Refinery</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The Refinery is only available to Prospectors. Sign up as a Prospector to hear ores under review, answer survey questions, rank, and leave comments for rewards.
          </p>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">The Refinery</h1>
        <p className="text-muted-foreground mt-1">
          Listen to ores under review unlimited times. Rank, answer surveys, and leave comments to earn Yield rewards.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : songs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No ores in The Refinery right now. Artists add their songs here for Prospector review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {songs.map((song) => (
            <Card key={song.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {song.artwork_url ? (
                    <img src={song.artwork_url} alt="" className="h-14 w-14 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded bg-muted flex items-center justify-center text-2xl">🎵</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{song.title}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">{song.artist_name}</p>
                  </div>
                  <Button
                    variant={playingId === song.id ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => handlePlay(song)}
                  >
                    {playingId === song.id ? 'Pause' : 'Play'}
                  </Button>
                </div>
                <audio
                  id={`refinery-audio-${song.id}`}
                  onEnded={() => setPlayingId((id) => (id === song.id ? null : id))}
                  onPause={() => setPlayingId((id) => (id === song.id ? null : id))}
                  className="hidden"
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rank 1–10 */}
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="w-24">Rank (1–10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="w-16"
                    value={rankBySong[song.id] ?? ''}
                    onChange={(e) => setRankBySong((r) => ({ ...r, [song.id]: parseInt(e.target.value, 10) || 0 }))}
                  />
                  <Button
                    size="sm"
                    disabled={submitting[song.id] === 'rank'}
                    onClick={() => submitRank(song.id)}
                  >
                    {submitting[song.id] === 'rank' ? 'Submitting…' : 'Submit rank'}
                  </Button>
                </div>

                {/* Survey (simple) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Genre</Label>
                    <Input
                      placeholder="e.g. Hip Hop"
                      value={surveyBySong[song.id]?.genre ?? ''}
                      onChange={(e) =>
                        setSurveyBySong((s) => ({
                          ...s,
                          [song.id]: { ...(s[song.id] ?? {}), genre: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mood</Label>
                    <Input
                      placeholder="e.g. Chill"
                      value={surveyBySong[song.id]?.mood ?? ''}
                      onChange={(e) =>
                        setSurveyBySong((s) => ({
                          ...s,
                          [song.id]: { ...(s[song.id] ?? {}), mood: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Would add to rotation?</Label>
                    <Input
                      placeholder="Yes / No / Maybe"
                      value={surveyBySong[song.id]?.wouldPlay ?? ''}
                      onChange={(e) =>
                        setSurveyBySong((s) => ({
                          ...s,
                          [song.id]: { ...(s[song.id] ?? {}), wouldPlay: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={submitting[song.id] === 'survey'}
                  onClick={() => submitSurvey(song.id)}
                >
                  {submitting[song.id] === 'survey' ? 'Submitting…' : 'Submit survey'}
                </Button>

                {/* Comments */}
                <div>
                  <Label className="text-sm">Comments</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      placeholder="Leave a comment…"
                      value={newCommentBySong[song.id] ?? ''}
                      onChange={(e) => setNewCommentBySong((c) => ({ ...c, [song.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && submitComment(song.id)}
                    />
                    <Button
                      size="sm"
                      disabled={submitting[song.id] === 'comment'}
                      onClick={() => submitComment(song.id)}
                    >
                      Post
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {commentsBySong[song.id]?.length ? (
                      commentsBySong[song.id].map((c) => (
                        <div key={c.id} className="text-sm py-1 border-b border-border/50">
                          <span className="font-medium">{c.users?.display_name ?? 'Prospector'}</span>
                          <span className="text-muted-foreground"> · {new Date(c.created_at).toLocaleString()}</span>
                          <p className="text-foreground mt-0.5">{c.body}</p>
                        </div>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => loadComments(song.id)}
                      >
                        Load comments
                      </button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
