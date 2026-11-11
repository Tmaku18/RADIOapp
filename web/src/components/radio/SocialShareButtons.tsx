'use client';

import { useState } from 'react';
import { SOCIAL_TARGETS, shareMediaFile, type SocialTargetId } from '@/lib/social-share';
import { SendClipDialog } from '@/components/messages/SendClipDialog';

export function SocialShareButtons({
  caption,
  getFile,
}: {
  caption: string;
  getFile: () => Promise<File>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [clip, setClip] = useState<File | null>(null);

  const sendToFriends = async () => {
    if (busy) return;
    setBusy('friends');
    setNote(null);
    try {
      const file = await getFile();
      setClip(file);
      setFriendsOpen(true);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not prepare that clip.');
    } finally {
      setBusy(null);
    }
  };

  const share = async (id: SocialTargetId) => {
    if (busy) return;
    setBusy(id);
    setNote(null);
    try {
      const file = await getFile();
      try {
        await navigator.clipboard.writeText(caption);
      } catch {
        // The file can still be shared when the clipboard is blocked.
      }
      const result = await shareMediaFile(file, caption);
      if (result === 'downloaded') {
        setNote('Clip downloaded. Upload it as a Story or post, and paste the caption.');
      } else if (result === 'shared') {
        setNote('Caption copied. Pick Story, Post, or send it to people.');
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Could not share that clip.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Instagram, Snapchat, and TikTok</p>
      <p className="text-xs text-muted-foreground">
        The song is in the clip. Your browser opens the share sheet, where you pick Story, Post, or people. The caption is copied so you can paste it.
      </p>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void sendToFriends()}
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
      >
        {busy === 'friends' ? 'Preparing…' : 'Send to friends'}
      </button>
      <div className="flex flex-wrap gap-2">
        {SOCIAL_TARGETS.map((target) => (
          <button
            key={target.id}
            type="button"
            disabled={busy !== null}
            onClick={() => void share(target.id)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-foreground hover:bg-white/10 disabled:opacity-40"
          >
            {busy === target.id ? 'Opening…' : target.label}
          </button>
        ))}
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      <SendClipDialog
        open={friendsOpen}
        file={clip}
        caption={caption}
        onOpenChange={setFriendsOpen}
      />
    </div>
  );
}
