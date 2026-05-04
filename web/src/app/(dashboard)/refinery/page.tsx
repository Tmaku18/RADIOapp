'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { refineryApi, prospectorApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { hasArtistCapability } from '@/lib/roles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { RefineryRewardsDialog } from '@/components/refinery/RefineryRewardsDialog';
import {
  REFINERY_RATING_QUESTIONS,
  REFINERY_REVIEW_REWARD_CENTS,
  REFINERY_SUBMISSION_PRICE_USD,
  REFINERY_SURVEY_QUESTIONS,
} from '@/data/refinery-questions';
import type { RefineryQueueSong } from '@/lib/api';

type ReviewerStatus = {
  isReviewer: boolean;
  signedUpAt: string | null;
  totalReviews: number;
};

type YieldStatus = {
  balanceCents: number;
  totalEarnedCents?: number;
  totalRedeemedCents?: number;
  songsRefinedCount: number;
  tier: 'none' | 'copper' | 'silver' | 'gold' | 'diamond';
};

export default function RefineryPage() {
  const { profile } = useAuth();
  const isArtist = hasArtistCapability(profile?.role);

  const [reviewer, setReviewer] = useState<ReviewerStatus | null>(null);
  const [songs, setSongs] = useState<RefineryQueueSong[]>([]);
  const [yieldStatus, setYieldStatus] = useState<YieldStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingUp, setSigningUp] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setError(null);
    try {
      const res = await refineryApi.getReviewerStatus();
      setReviewer(res.data);
    } catch {
      setReviewer({ isReviewer: false, signedUpAt: null, totalReviews: 0 });
    }
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const res = await refineryApi.listSongs({ limit: 100 });
      const data = res.data as { songs: RefineryQueueSong[] };
      setSongs(data?.songs ?? []);
    } catch {
      setError('Failed to load The Refinery queue.');
    }
  }, []);

  const loadYield = useCallback(async () => {
    try {
      const res = await prospectorApi.getYield();
      setYieldStatus(res.data as YieldStatus);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      await loadStatus();
      if (cancelled) return;
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadStatus]);

  useEffect(() => {
    if (reviewer?.isReviewer) {
      void loadQueue();
      void loadYield();
    }
  }, [reviewer?.isReviewer, loadQueue, loadYield]);

  const handleSignup = async () => {
    setSigningUp(true);
    setError(null);
    try {
      await refineryApi.signUpReviewer();
      await loadStatus();
    } catch {
      setError('Could not sign you up. Please try again.');
    } finally {
      setSigningUp(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">The Refinery</h1>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!reviewer?.isReviewer) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">The Refinery</h1>
          <p className="text-muted-foreground mt-1">
            In-depth, paid song reviews. Artists get real, structured feedback;
            reviewers earn rewards.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-foreground mb-1">For artists</h3>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                <li>
                  Submit any of your songs to The Refinery for $
                  {REFINERY_SUBMISSION_PRICE_USD}.
                </li>
                <li>
                  Add up to 10 of your own custom questions to ask reviewers.
                </li>
                <li>
                  Get a guaranteed minimum of 100 in-depth reviews from
                  verified reviewers.
                </li>
                <li>
                  See real-time analytics: mean &amp; median ratings, response
                  distributions, outliers flagged, and every individual review.
                </li>
                <li>
                  Private songs are eligible too — reviewers can hear them
                  even though they&apos;re hidden from the radio.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">
                For reviewers
              </h3>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                <li>Sign up below — you&apos;re accepted automatically.</li>
                <li>
                  Listen to songs in the queue and answer 7 rating questions
                  (1-10), 12 standard survey questions, plus the artist&apos;s
                  custom questions.
                </li>
                <li>
                  Earn ${(REFINERY_REVIEW_REWARD_CENTS / 100).toFixed(2)} per
                  completed review, redeemable for Visa gift cards.
                </li>
                <li>
                  Songs are shuffled fairly — every artist gets reviews over
                  time.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What every review covers</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 text-sm">
            <div>
              <h3 className="font-medium text-foreground mb-2">
                1-10 rating questions
              </h3>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                {REFINERY_RATING_QUESTIONS.map((q) => (
                  <li key={q.key}>{q.question}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">
                Survey questions
              </h3>
              <ul className="text-muted-foreground list-disc pl-5 space-y-1">
                {REFINERY_SURVEY_QUESTIONS.map((q) => (
                  <li key={q.key}>{q.question}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 text-center space-y-4">
            <h2 className="text-xl font-semibold">Become a reviewer</h2>
            <p className="text-muted-foreground">
              Earn rewards while helping artists improve their music.
            </p>
            <Button onClick={handleSignup} disabled={signingUp} size="lg">
              {signingUp ? 'Signing up…' : 'Sign up as a reviewer'}
            </Button>
            {isArtist && (
              <p className="text-sm text-muted-foreground">
                You&apos;re an artist — head to{' '}
                <Link href="/artist/songs" className="text-primary underline">
                  My Songs
                </Link>{' '}
                to submit a track for review.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">The Refinery</h1>
          <p className="text-muted-foreground mt-1">
            Listen, answer the survey, and earn $
            {(REFINERY_REVIEW_REWARD_CENTS / 100).toFixed(2)} per review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setRewardsOpen(true)}>
            Rewards
          </Button>
          {isArtist && (
            <Button asChild variant="outline">
              <Link href="/artist/songs">Submit a song</Link>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Reviews you&apos;ve done</p>
            <p className="text-2xl font-bold">{reviewer.totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Songs in queue</p>
            <p className="text-2xl font-bold">{songs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Yield balance</p>
            <p className="text-2xl font-bold">
              ${((yieldStatus?.balanceCents ?? 0) / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No songs waiting for review right now. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Songs to review</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead>Song</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead>Custom questions</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.songId}>
                    <TableCell className="font-medium">
                      {song.artistName}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArtworkImage
                          src={song.artworkUrl}
                          alt={song.title}
                          className="h-8 w-8 rounded object-cover"
                        />
                        <span className="truncate">{song.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {song.reviewCount}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {song.likeCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={song.hasCustomQuestions ? 'default' : 'outline'}
                      >
                        {song.hasCustomQuestions ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm">
                        <Link href={`/refinery/review/${song.songId}`}>
                          Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RefineryRewardsDialog
        open={rewardsOpen}
        onOpenChange={setRewardsOpen}
        balanceCents={yieldStatus?.balanceCents ?? 0}
        totalReviews={reviewer.totalReviews}
        onChange={() => {
          void loadYield();
        }}
      />
    </div>
  );
}
