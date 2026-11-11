'use client';

import { useCallback, useEffect, useState } from 'react';
import { songStoriesApi, type SongStory } from '@/lib/api';

const PREF_KEY = 'networx.songStories';

function songIdOk(songId?: string | null): songId is string {
  return !!songId && /^[0-9a-f-]{36}$/i.test(songId);
}

export function SongStoriesBar({
  songId,
  compact = false,
}: {
  songId?: string | null;
  compact?: boolean;
}) {
  const [enabled, setEnabled] = useState(true);
  const [stories, setStories] = useState<SongStory[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(PREF_KEY) !== 'off');
  }, []);

  const load = useCallback(async () => {
    if (!songIdOk(songId)) {
      setStories([]);
      return;
    }
    try {
      const res = await songStoriesApi.list(songId);
      setStories(res.data?.stories ?? []);
    } catch {
      setStories([]);
    }
  }, [songId]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(PREF_KEY, next ? 'on' : 'off');
  };

  if (!songIdOk(songId)) return null;
  if (compact && (!enabled || stories.length === 0)) return null;

  const shell = compact ? 'flex max-w-[148px] items-center overflow-hidden' : 'mt-3 space-y-2';

  const open = stories[openIndex ?? -1];

  return (
    <div className={shell}>
      {!compact ? (
        <button
          type="button"
          onClick={toggle}
          className="text-xs text-white/70 underline-offset-2 hover:underline"
        >
          {enabled ? 'Hide song stories' : 'Show song stories'}
        </button>
      ) : null}
      {enabled && stories.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto">
          {(compact ? stories.slice(0, 3) : stories).map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              title={story.author.displayName}
              className={`h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 ${
                story.visibility === 'private' ? 'border-white/30' : 'border-cyan-300'
              }`}
            >
              {story.author.avatarUrl ? (
                // Avatars are remote user photos.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={story.author.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-zinc-800 text-xs text-white">
                  {story.author.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
      {enabled && !compact && stories.length === 0 ? (
        <p className="text-xs text-white/45">
          No stories for this song yet. Public stories stay up for 24 hours.
        </p>
      ) : null}
      {open && openIndex != null ? (
        <StoryViewer
          story={open}
          onClose={() => setOpenIndex(null)}
          onPrev={openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined}
          onNext={
            openIndex < stories.length - 1 ? () => setOpenIndex(openIndex + 1) : undefined
          }
          onChanged={() => void load()}
          onDeleted={() => {
            setOpenIndex(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function StoryViewer({
  story,
  onClose,
  onPrev,
  onNext,
  onChanged,
  onDeleted,
}: {
  story: SongStory;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVisibility = async (visibility: 'public' | 'private') => {
    setBusy(true);
    setError(null);
    try {
      await songStoriesApi.setVisibility(story.id, visibility);
      onChanged();
    } catch {
      setError('Could not update this story.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await songStoriesApi.remove(story.id);
      onDeleted();
    } catch {
      setError('Could not delete this story.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="truncate text-sm font-semibold">
          {story.author.displayName}
          {story.visibility === 'private' ? ' · Private' : ''}
        </p>
        <button type="button" onClick={onClose} className="text-sm text-white/80">
          Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <video
          key={story.id}
          src={story.mediaUrl}
          controls
          autoPlay
          playsInline
          className="h-full w-full object-contain"
        />
      </div>
      <div className="space-y-2 px-4 py-4">
        {story.caption ? <p className="text-sm">{story.caption}</p> : null}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {onPrev ? (
            <button type="button" onClick={onPrev} className="rounded-full border border-white/20 px-3 py-1.5 text-xs">
              Previous
            </button>
          ) : null}
          {onNext ? (
            <button type="button" onClick={onNext} className="rounded-full border border-white/20 px-3 py-1.5 text-xs">
              Next
            </button>
          ) : null}
          {story.mine ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void setVisibility(story.visibility === 'public' ? 'private' : 'public')
                }
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {story.visibility === 'public' ? 'Make private' : 'Make public'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove()}
                className="rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-200 disabled:opacity-40"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
