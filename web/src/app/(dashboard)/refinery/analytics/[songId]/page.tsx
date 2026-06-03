'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { refineryApi } from '@/lib/api';
import type { RefineryAnalyticsPayload } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import {
  REFINERY_RATING_QUESTIONS,
  REFINERY_SURVEY_QUESTIONS,
} from '@/data/refinery-questions';

const REFRESH_INTERVAL_MS = 30_000;

type ReviewItem = RefineryAnalyticsPayload['reviews'][number];

function sortReviews(reviews: ReviewItem[]): ReviewItem[] {
  return [...reviews].sort((a, b) => {
    const af = a.favorited ? 1 : 0;
    const bf = b.favorited ? 1 : 0;
    if (af !== bf) return bf - af;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}

export default function RefineryAnalyticsPage() {
  const params = useParams<{ songId: string }>();
  const search = useSearchParams();
  const songId = params?.songId;
  const justSubmitted = search?.get('success') === 'true';

  const [data, setData] = useState<RefineryAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!songId) return;
    try {
      const res = await refineryApi.getAnalytics(songId, { limit: 100 });
      setData(res.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object'
          ? ((err as { response?: { data?: { message?: unknown } } }).response
              ?.data?.message as string | undefined)
          : undefined;
      setError(msg ?? 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const patchReview = useCallback(
    (reviewId: string, patch: Partial<ReviewItem>) => {
      setData((prev) => {
        if (!prev) return prev;
        const reviews = sortReviews(
          prev.reviews.map((r) =>
            r.id === reviewId ? { ...r, ...patch } : r,
          ),
        );
        const favoritedCount = reviews.filter((r) => r.favorited).length;
        return { ...prev, reviews, summary: { ...prev.summary, favoritedCount } };
      });
    },
    [],
  );

  const toggleFavorite = useCallback(
    async (r: ReviewItem) => {
      if (!songId) return;
      const next = !r.favorited;
      patchReview(r.id, { favorited: next });
      try {
        await refineryApi.favoriteReview(songId, r.id, next);
      } catch {
        patchReview(r.id, { favorited: !next });
      }
    },
    [songId, patchReview],
  );

  const rateQuality = useCallback(
    async (r: ReviewItem, rating: number) => {
      if (!songId) return;
      // Tapping the current rating again clears it.
      const next = r.qualityRating === rating ? null : rating;
      const prevRating = r.qualityRating;
      patchReview(r.id, { qualityRating: next });
      try {
        await refineryApi.rateReviewQuality(songId, r.id, next);
      } catch {
        patchReview(r.id, { qualityRating: prevRating });
      }
    },
    [songId, patchReview],
  );

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (loading && !data) {
    return <p className="text-muted-foreground">Loading analytics…</p>;
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/artist/songs">Back to my songs</Link>
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const progressPct = Math.min(
    100,
    (data.song.reviewCount / Math.max(1, data.song.minReviews)) * 100,
  );

  return (
    <div className="space-y-6">
      {justSubmitted && (
        <Alert>
          <AlertDescription>
            Submission complete! Your song is now in The Refinery. Reviews will
            appear here in real time.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ArtworkImage
            src={data.song.artworkUrl}
            alt={data.song.title}
            className="h-14 w-14 rounded object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {data.song.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              {data.song.artistName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.song.inRefinery ? 'default' : 'secondary'}>
            {data.song.inRefinery ? 'In Refinery' : 'Completed'}
          </Badge>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress to minimum</span>
            <span className="font-medium">
              {data.song.reviewCount} / {data.song.minReviews} reviews
            </span>
          </div>
          <div className="h-2 bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {data.summary.outlierCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {data.summary.outlierCount} outlier
              {data.summary.outlierCount === 1 ? '' : 's'} flagged (rating
              &gt;2σ from the mean).
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rating averages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {REFINERY_RATING_QUESTIONS.map((q) => {
            const stats = data.summary.ratingStats[q.key];
            const pct = stats?.mean ? (stats.mean / 10) * 100 : 0;
            return (
              <div key={q.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-foreground">{q.question}</span>
                  <span className="text-muted-foreground">
                    {stats?.mean ?? '—'} avg
                    {stats?.median != null && (
                      <> · {stats.median} median</>
                    )}
                    {stats?.stddev != null && (
                      <> · σ {stats.stddev}</>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Survey responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {REFINERY_SURVEY_QUESTIONS.map((q) => {
            const dist = data.summary.surveyDistributions[q.key] ?? {};
            const total = q.options.reduce(
              (acc, opt) => acc + (dist[opt] ?? 0),
              0,
            );
            return (
              <div key={q.key}>
                <p className="font-medium mb-1">{q.question}</p>
                <div className="space-y-1">
                  {q.options.map((opt) => {
                    const count = dist[opt] ?? 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={opt}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{opt}</span>
                          <span className="text-muted-foreground">
                            {count} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {data.summary.customQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your custom questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {data.summary.customQuestions.map((cq) => (
              <div key={cq.id}>
                <p className="font-medium">{cq.questionText}</p>
                <p className="text-xs text-muted-foreground mb-1">
                  {cq.totalResponses} response
                  {cq.totalResponses === 1 ? '' : 's'}
                </p>
                {cq.recentResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No answers yet.
                  </p>
                ) : (
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    {cq.recentResponses.map((response, idx) => (
                      <li key={idx}>{response}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card id="reviews">
        <CardHeader>
          <CardTitle>
            Individual reviews ({data.summary.totalReviews})
            {data.summary.favoritedCount > 0 && (
              <span className="ml-2 text-sm font-normal text-amber-500">
                ★ {data.summary.favoritedCount} favorited
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No reviews yet. Hang tight — they&apos;ll appear here as soon as
              listeners submit them.
            </p>
          ) : (
            <ul className="space-y-4 divide-y">
              {data.reviews.map((r) => (
                <li
                  key={r.id}
                  className={`pt-4 first:pt-0 first:border-t-0 ${
                    r.favorited
                      ? '-mx-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center gap-2">
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                      {r.isOutlier && (
                        <Badge variant="destructive">Outlier</Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(r)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium transition-colors ${
                        r.favorited
                          ? 'border-amber-500/50 text-amber-500'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      aria-pressed={r.favorited}
                      title={r.favorited ? 'Remove favorite' : 'Favorite this review'}
                    >
                      <span>{r.favorited ? '★' : '☆'}</span>
                      <span>{r.favorited ? 'Favorited' : 'Favorite'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                    {(
                      [
                        ['overall', r.overallRating],
                        ['beat', r.beatRating],
                        ['lyrics', r.lyricsRating],
                        ['chorus', r.chorusRating],
                        ['intro/outro', r.openingEndingRating],
                      ] as Array<[string, number]>
                    ).map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded bg-muted px-2 py-1"
                      >
                        <span className="truncate text-muted-foreground">
                          {label}
                        </span>
                        <span className="font-semibold ml-2">{value}</span>
                      </div>
                    ))}
                  </div>
                  {r.comment && (
                    <p className="text-sm text-foreground italic">
                      “{r.comment}”
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">
                      Feedback quality:
                    </span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => void rateQuality(r, n)}
                        className="text-lg leading-none transition-colors"
                        aria-label={`Rate feedback ${n} of 5`}
                        title={`${n} star${n > 1 ? 's' : ''}`}
                      >
                        <span
                          className={
                            (r.qualityRating ?? 0) >= n
                              ? 'text-amber-500'
                              : 'text-muted-foreground/40 hover:text-amber-500/60'
                          }
                        >
                          ★
                        </span>
                      </button>
                    ))}
                    {r.qualityRating != null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {r.qualityRating}/5
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
