'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { suggestionsApi, usersApi } from '@/lib/api';
import { artistProfilePath } from '@/lib/artist-links';
import { GENRE_OPTIONS, genreLabel } from '@/data/genre-options';
import { ArtworkImage } from '@/components/common/ArtworkImage';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SuggestedArtist = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  songCount?: number;
  matchedGenres: string[];
};

type GenreOnboardingDialogProps = {
  open: boolean;
  userId: string;
  onCompleted: () => void;
};

export function GenreOnboardingDialog({
  open,
  userId,
  onCompleted,
}: GenreOnboardingDialogProps) {
  const [step, setStep] = useState<'genres' | 'artists'>('genres');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [artists, setArtists] = useState<SuggestedArtist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seed = useMemo(
    () => `${userId}:${Date.now().toString(36)}`,
    [userId, open],
  );

  useEffect(() => {
    if (!open) {
      setStep('genres');
      setSelectedGenres([]);
      setArtists([]);
      setError(null);
    }
  }, [open]);

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((g) => g !== genreId)
        : [...prev, genreId],
    );
  };

  const selectAllGenres = () => {
    setSelectedGenres(GENRE_OPTIONS.map((g) => g.id));
  };

  const clearGenres = () => {
    setSelectedGenres([]);
  };

  const finishOnboarding = useCallback(
    async (genres: string[]) => {
      setSaving(true);
      setError(null);
      try {
        await usersApi.updateMe({
          favoriteGenres: genres,
          completeGenreOnboarding: true,
        });
        onCompleted();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not save your preferences. Please try again.',
        );
      } finally {
        setSaving(false);
      }
    },
    [onCompleted],
  );

  const loadArtistSuggestions = async () => {
    if (selectedGenres.length === 0) {
      setError('Pick at least one genre to continue.');
      return;
    }
    setLoadingArtists(true);
    setError(null);
    try {
      const { data } = await suggestionsApi.getGenreArtists({
        genres: selectedGenres,
        limit: 12,
        seed,
      });
      const list = (data.artists ?? []) as SuggestedArtist[];
      setArtists(list);
      setStep('artists');
      if (!list.length) {
        await finishOnboarding(selectedGenres);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load artist suggestions.',
      );
    } finally {
      setLoadingArtists(false);
    }
  };

  const handleSkip = () => {
    void finishOnboarding([]);
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 'genres' ? (
          <>
            <DialogHeader>
              <DialogTitle>What do you like to listen to?</DialogTitle>
              <DialogDescription>
                Pick your favorite genres and we&apos;ll suggest artists on
                Networx who match your taste.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {selectedGenres.length === 0
                  ? 'Select all genres you enjoy.'
                  : `${selectedGenres.length} selected`}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllGenres}
                  disabled={selectedGenres.length === GENRE_OPTIONS.length}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearGenres}
                  disabled={selectedGenres.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 py-2">
              {GENRE_OPTIONS.map((genre) => {
                const active = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted/40 text-foreground hover:bg-muted',
                    )}
                  >
                    {genre.label}
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                disabled={saving || loadingArtists}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                onClick={() => void loadArtistSuggestions()}
                disabled={
                  saving || loadingArtists || selectedGenres.length === 0
                }
              >
                {loadingArtists ? 'Finding artists…' : 'Continue'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Artists you might like</DialogTitle>
              <DialogDescription>
                Based on{' '}
                {selectedGenres.map((g) => genreLabel(g)).join(', ')} — shuffled
                so you discover someone new each time.
              </DialogDescription>
            </DialogHeader>

            {artists.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No artists found for those genres yet. You can update this later
                in settings.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 py-2">
                {artists.map((artist) => (
                  <li
                    key={artist.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                      <ArtworkImage
                        src={artist.avatarUrl}
                        alt={artist.displayName ?? 'Artist'}
                        className="h-12 w-12 object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {artist.displayName ?? 'Artist'}
                      </p>
                      {artist.headline && (
                        <p className="text-xs text-muted-foreground truncate">
                          {artist.headline}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {artist.matchedGenres
                          .map((g) => genreLabel(g))
                          .join(' · ')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={artistProfilePath(artist.id)}>View</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                onClick={() => void finishOnboarding(selectedGenres)}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Start exploring'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
