'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  REFINERY_DEFAULT_MIN_REVIEWS,
  REFINERY_MAX_CUSTOM_QUESTIONS,
  REFINERY_RATING_QUESTIONS,
  REFINERY_SUBMISSION_ORIGINAL_PRICE_USD,
  REFINERY_SUBMISSION_PRICE_USD,
  REFINERY_SURVEY_QUESTIONS,
} from '@/data/refinery-questions';

interface RefinerySubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  song: { id: string; title: string } | null;
  /** Returns the redirect URL. The dialog will redirect on success. */
  onSubmit: (
    songId: string,
    customQuestions: string[],
  ) => Promise<{ url?: string }>;
}

export function RefinerySubmitDialog({
  open,
  onOpenChange,
  song,
  onSubmit,
}: RefinerySubmitDialogProps) {
  const [questions, setQuestions] = useState<string[]>(['']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuestions(['']);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const updateQuestion = (idx: number, value: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) =>
      prev.length < REFINERY_MAX_CUSTOM_QUESTIONS ? [...prev, ''] : prev,
    );
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!song) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = questions.map((q) => q.trim()).filter((q) => q.length > 0);
      const res = await onSubmit(song.id, trimmed);
      if (!res?.url) {
        setError('Could not start checkout. Please try again.');
        setSubmitting(false);
      }
      // On success the parent will redirect to Stripe Checkout.
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object'
          ? ((err as { response?: { data?: { message?: unknown } } }).response?.data
              ?.message as string | undefined)
          : undefined;
      setError(message ?? 'Failed to submit. Please try again.');
      setSubmitting(false);
    }
  };

  if (!song) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Submit &quot;{song.title}&quot; to The Refinery
          </DialogTitle>
          <DialogDescription>
            Pay{' '}
            <span className="text-muted-foreground line-through">
              ${REFINERY_SUBMISSION_ORIGINAL_PRICE_USD}
            </span>{' '}
            <span className="font-semibold text-foreground">
              ${REFINERY_SUBMISSION_PRICE_USD}
            </span>{' '}
            for an in-depth review by at least {REFINERY_DEFAULT_MIN_REVIEWS}{' '}
            verified reviewers. You&apos;ll see real-time analytics as reviews
            come in, plus every individual review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-medium text-foreground mb-2">
              What every reviewer rates (1-10)
            </h3>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {REFINERY_RATING_QUESTIONS.map((q) => (
                <li key={q.key}>{q.question}</li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-medium text-foreground mb-2">
              Standard survey questions
            </h3>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 max-h-40 overflow-y-auto">
              {REFINERY_SURVEY_QUESTIONS.map((q) => (
                <li key={q.key}>{q.question}</li>
              ))}
            </ul>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">
                Your custom questions (optional, up to {REFINERY_MAX_CUSTOM_QUESTIONS})
              </h3>
              <span className="text-xs text-muted-foreground">
                {questions.filter((q) => q.trim().length > 0).length}/
                {REFINERY_MAX_CUSTOM_QUESTIONS}
              </span>
            </div>
            <div className="space-y-2">
              {questions.map((q, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Label className="sr-only" htmlFor={`q-${idx}`}>
                    Custom question {idx + 1}
                  </Label>
                  <Input
                    id={`q-${idx}`}
                    placeholder="e.g. Was the chorus catchy enough to remember?"
                    value={q}
                    maxLength={280}
                    onChange={(e) => updateQuestion(idx, e.target.value)}
                  />
                  {questions.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeQuestion(idx)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {questions.length < REFINERY_MAX_CUSTOM_QUESTIONS && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addQuestion}
                >
                  + Add another question
                </Button>
              )}
            </div>
          </section>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? 'Redirecting…'
              : `Pay $${REFINERY_SUBMISSION_PRICE_USD} & submit`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
