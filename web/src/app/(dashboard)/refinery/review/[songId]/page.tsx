'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { refineryApi } from '@/lib/api';
import type {
  RefineryReviewFormPayload,
  RefinerySubmitReviewPayload,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import {
  REFINERY_RATING_QUESTIONS,
  REFINERY_REVIEW_REWARD_CENTS,
  REFINERY_SURVEY_QUESTIONS,
  RatingKey,
} from '@/data/refinery-questions';

type Ratings = Record<RatingKey, number>;
type SurveyAnswers = Record<string, string>;
type CustomAnswers = Record<string, string>;

const initialRatings: Ratings = {
  overall_rating: 5,
  beat_rating: 5,
  lyrics_rating: 5,
  chorus_rating: 5,
  opening_ending_rating: 5,
};

export default function ReviewPage() {
  const router = useRouter();
  const params = useParams<{ songId: string }>();
  const songId = params?.songId;

  const [form, setForm] = useState<RefineryReviewFormPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ratings, setRatings] = useState<Ratings>(initialRatings);
  const [survey, setSurvey] = useState<SurveyAnswers>({});
  const [customAnswers, setCustomAnswers] = useState<CustomAnswers>({});
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    if (!songId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await refineryApi.getReviewForm(songId);
      setForm(res.data);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object'
          ? ((err as { response?: { data?: { message?: unknown } } }).response
              ?.data?.message as string | undefined)
          : undefined;
      setError(msg ?? 'Failed to load review form.');
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRating = (key: RatingKey, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const allSurveyAnswered = REFINERY_SURVEY_QUESTIONS.every(
    (q) => typeof survey[q.key] === 'string' && survey[q.key].length > 0,
  );

  const handleSubmit = async () => {
    if (!songId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: RefinerySubmitReviewPayload = {
        overallRating: ratings.overall_rating,
        beatRating: ratings.beat_rating,
        lyricsRating: ratings.lyrics_rating,
        chorusRating: ratings.chorus_rating,
        openingEndingRating: ratings.opening_ending_rating,
        surveyResponses: survey,
        customResponses: customAnswers,
        comment: comment.trim() || undefined,
      };
      await refineryApi.submitReview(songId, payload);
      router.push('/refinery?reviewed=1');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object'
          ? ((err as { response?: { data?: { message?: unknown } } }).response
              ?.data?.message as string | undefined)
          : undefined;
      setError(msg ?? 'Failed to submit review.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading review form…</p>;
  }

  if (error && !form) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <Link href="/refinery">Back to The Refinery</Link>
        </Button>
      </div>
    );
  }

  if (!form) return null;

  const { song, customQuestions } = form;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review song</h1>
        <p className="text-muted-foreground mt-1">
          Listen to the full song, then complete every section. You&apos;ll
          earn ${(REFINERY_REVIEW_REWARD_CENTS / 100).toFixed(2)} when you
          submit.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <ArtworkImage
              src={song.artworkUrl}
              alt={song.title}
              className="h-14 w-14 rounded object-cover"
            />
            <div>
              <CardTitle>{song.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{song.artistName}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <audio controls src={song.audioUrl} className="w-full" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate each aspect (1-10)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {REFINERY_RATING_QUESTIONS.map((q) => (
            <div key={q.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{q.question}</Label>
                <span className="text-sm font-semibold w-8 text-right">
                  {ratings[q.key]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={ratings[q.key]}
                onChange={(e) =>
                  updateRating(q.key as RatingKey, Number(e.target.value))
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Survey questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {REFINERY_SURVEY_QUESTIONS.map((q) => (
            <div key={q.key} className="space-y-2">
              <Label className="text-sm font-medium">{q.question}</Label>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const checked = survey[q.key] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`text-sm rounded-full px-3 py-1 border transition-colors ${
                        checked
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                      onClick={() =>
                        setSurvey((prev) => ({ ...prev, [q.key]: opt }))
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {customQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>The artist&apos;s questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customQuestions.map((q) => (
              <div key={q.id} className="space-y-1">
                <Label className="text-sm font-medium">{q.questionText}</Label>
                <Textarea
                  rows={2}
                  value={customAnswers[q.id] ?? ''}
                  maxLength={1000}
                  onChange={(e) =>
                    setCustomAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  placeholder="Your answer…"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Optional comment</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything else you want to share with the artist?"
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/refinery">Cancel</Link>
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={submitting || !allSurveyAnswered}
          size="lg"
        >
          {submitting
            ? 'Submitting…'
            : `Submit review (+$${(REFINERY_REVIEW_REWARD_CENTS / 100).toFixed(2)})`}
        </Button>
      </div>
      {!allSurveyAnswered && (
        <p className="text-xs text-muted-foreground text-right">
          Please answer every survey question to submit.
        </p>
      )}
    </div>
  );
}
