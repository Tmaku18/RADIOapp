'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi } from '@/lib/api';
import { DiscoverClipDialog } from '@/components/songs/DiscoverClipDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SwipeCard = {
  songId: string;
  title: string;
  artistId: string;
  artistName: string | null;
  artistDisplayName: string | null;
  status: string | null;
  durationSeconds: number | null;
  audioUrl: string | null;
  discoverEnabled: boolean;
  clipUrl: string | null;
  backgroundUrl: string | null;
  clipStartSeconds: number | null;
  clipEndSeconds: number | null;
  clipDurationSeconds: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  return `${Number(value).toFixed(1)}s`;
}

export default function AdminSwipePage() {
  const [cards, setCards] = useState<SwipeCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [confirmSongId, setConfirmSongId] = useState<string | null>(null);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedCard = useMemo(
    () => cards.find((card) => card.songId === confirmSongId) ?? null,
    [cards, confirmSongId],
  );
  const editingCard = useMemo(
    () => cards.find((card) => card.songId === editingSongId) ?? null,
    [cards, editingSongId],
  );

  const stopPreview = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlayingSongId(null);
  };

  const togglePlay = (card: SwipeCard) => {
    const src = card.clipUrl || card.audioUrl;
    if (!src) return;
    if (playingSongId === card.songId) {
      stopPreview();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener('ended', () => setPlayingSongId(null));
    }
    audioRef.current.src = src;
    void audioRef.current.play();
    setPlayingSongId(card.songId);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSwipeCards({
        search: search || undefined,
        limit: 250,
        offset: 0,
      });
      setCards(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch (error) {
      console.error('Failed to load swipe cards:', error);
      setCards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCards();
  }, [search]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleDeleteClip = async (songId: string) => {
    if (playingSongId === songId) stopPreview();
    setDeletingSongId(songId);
    setConfirmSongId(null);
    try {
      await adminApi.deleteSwipeClip(songId);
      setCards((prev) =>
        prev.map((card) =>
          card.songId === songId
            ? {
                ...card,
                discoverEnabled: false,
                clipUrl: null,
                backgroundUrl: null,
                clipStartSeconds: null,
                clipEndSeconds: null,
                clipDurationSeconds: null,
              }
            : card,
        ),
      );
    } catch (error) {
      console.error('Failed to delete discover clip:', error);
    } finally {
      setDeletingSongId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Swipe</h2>
              <p className="text-sm text-muted-foreground">
                Play and edit Discover clips, or remove them from Swipe.
              </p>
            </div>
            <Badge variant="secondary">{total} cards</Badge>
          </div>
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by song or artist"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : cards.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No swipe cards found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Song</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clip Range</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[280px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((card) => {
                  const artistLabel =
                    card.artistDisplayName ||
                    card.artistName ||
                    'Unknown artist';
                  const hasClip = Boolean(card.clipUrl);
                  return (
                    <TableRow key={card.songId}>
                      <TableCell>
                        <div className="font-medium">{card.title || 'Untitled'}</div>
                        <div className="text-xs text-muted-foreground">
                          {card.songId}
                        </div>
                      </TableCell>
                      <TableCell>{artistLabel}</TableCell>
                      <TableCell>
                        <Badge variant={card.discoverEnabled ? 'default' : 'secondary'}>
                          {card.discoverEnabled ? 'Published' : 'Unpublished'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatSeconds(card.clipStartSeconds)} -{' '}
                        {formatSeconds(card.clipEndSeconds)}
                      </TableCell>
                      <TableCell>{formatSeconds(card.clipDurationSeconds)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {card.updatedAt
                          ? new Date(card.updatedAt).toLocaleString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!hasClip && !card.audioUrl}
                            onClick={() => togglePlay(card)}
                          >
                            {playingSongId === card.songId ? 'Pause' : 'Play'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!card.audioUrl}
                            onClick={() => {
                              stopPreview();
                              setEditingSongId(card.songId);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!hasClip || deletingSongId === card.songId}
                            onClick={() => setConfirmSongId(card.songId)}
                          >
                            {deletingSongId === card.songId
                              ? 'Deleting...'
                              : 'Delete clip'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(confirmSongId)}
        onOpenChange={() => setConfirmSongId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete 15-second clip?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCard
                ? `This removes the discover clip for "${selectedCard.title}" and unpublishes it from Swipe.`
                : 'This removes the discover clip and unpublishes it from Swipe.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmSongId) return;
                void handleDeleteClip(confirmSongId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete clip
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DiscoverClipDialog
        open={Boolean(editingCard)}
        onOpenChange={(open) => {
          if (!open) setEditingSongId(null);
        }}
        song={
          editingCard
            ? {
                id: editingCard.songId,
                title: editingCard.title || 'Untitled',
                audioUrl: editingCard.audioUrl,
                durationSeconds: editingCard.durationSeconds,
                discoverEnabled: editingCard.discoverEnabled,
                discoverClipStartSeconds: editingCard.clipStartSeconds,
                discoverClipEndSeconds: editingCard.clipEndSeconds,
              }
            : null
        }
        onSaved={(result) => {
          setCards((prev) =>
            prev.map((card) =>
              card.songId === editingCard?.songId
                ? {
                    ...card,
                    discoverEnabled: result.discoverEnabled,
                    clipUrl: result.discoverClipUrl ?? card.clipUrl,
                    clipStartSeconds: result.discoverClipStartSeconds,
                    clipEndSeconds: result.discoverClipEndSeconds,
                    clipDurationSeconds:
                      result.discoverClipEndSeconds -
                      result.discoverClipStartSeconds,
                  }
                : card,
            ),
          );
        }}
      />
    </div>
  );
}
