'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Send, Bookmark, Trash2, Maximize2, X } from 'lucide-react';
import {
  discoveryApi,
  moderationApi,
  proNetworkSubscriptionApi,
  type DiscoverFeedPost,
  type DiscoverFeedComment,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SharePostDialog } from './SharePostDialog';
import { PaywallCard } from './PaywallCard';
import { useAuth } from '@/contexts/AuthContext';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { UserSafetyMenu } from '@/components/safety/UserSafetyMenu';
import { toast } from 'sonner';

function shouldUnoptimize(url?: string | null): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

interface FeedPostCardProps {
  post: DiscoverFeedPost;
  onChange?: (next: DiscoverFeedPost) => void;
  onHidden?: () => void;
  variant?: 'feed' | 'detail';
}

export function FeedPostCard({ post, onChange, onHidden, variant = 'feed' }: FeedPostCardProps) {
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playback = usePlaybackOptional();
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const [videoOpen, setVideoOpen] = useState(false);
  useEffect(() => {
    return () => {
      videoRef.current?.pause();
      fullscreenVideoRef.current?.pause();
      audioRef.current?.pause();
    };
  }, []);
  useEffect(() => {
    if (!videoOpen) return;
    const pb = playbackRef.current;
    const holdRadio =
      pb?.state.source === 'radio' && !pb.state.isMuted && pb.state.isPlaying;
    if (holdRadio) pb.softPause();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVideoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      fullscreenVideoRef.current?.pause();
      if (holdRadio) void playbackRef.current?.softResume();
    };
  }, [videoOpen]);
  const isOwnPost = profile?.id === post.authorUserId;
  const canDelete = isOwnPost || profile?.role === 'admin';
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [deleting, setDeleting] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [showComments, setShowComments] = useState(variant === 'detail');
  const [comments, setComments] = useState<DiscoverFeedComment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  // Commenting is a paid Pro-Networx feature; null = not yet checked.
  const [canComment, setCanComment] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookmarkedByMe, setBookmarkedByMe] = useState(post.bookmarkedByMe);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const propagate = (patch: Partial<DiscoverFeedPost>) => {
    onChange?.({ ...post, ...patch });
  };

  const handleToggleBookmark = async () => {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const wasBookmarked = bookmarkedByMe;
    const next = !wasBookmarked;
    setBookmarkedByMe(next);
    propagate({ bookmarkedByMe: next });
    try {
      if (next) await discoveryApi.bookmarkPost(post.id);
      else await discoveryApi.unbookmarkPost(post.id);
    } catch {
      setBookmarkedByMe(wasBookmarked);
      propagate({ bookmarkedByMe: wasBookmarked });
    } finally {
      setBookmarkBusy(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (
      !window.confirm(
        'Delete this post? It will be removed from the feed for everyone.',
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await discoveryApi.deletePost(post.id);
      toast.success('Post deleted');
      onHidden?.();
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Could not delete post',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const wasLiked = likedByMe;
    const nextLiked = !wasLiked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setLikedByMe(nextLiked);
    setLikeCount(nextCount);
    propagate({ likedByMe: nextLiked, likeCount: nextCount });
    try {
      if (nextLiked) await discoveryApi.likePost(post.id);
      else await discoveryApi.unlikePost(post.id);
    } catch {
      setLikedByMe(wasLiked);
      setLikeCount(likeCount);
      propagate({ likedByMe: wasLiked, likeCount });
    } finally {
      setBusy(false);
    }
  };

  const ensureComments = async () => {
    if (comments != null) return;
    setLoadingComments(true);
    try {
      const res = await discoveryApi.listComments(post.id, { limit: 50 });
      setComments(res.data?.items ?? []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const ensureCommentAccess = async () => {
    if (canComment != null) return;
    try {
      const res = await proNetworkSubscriptionApi.getAccess();
      setCanComment(!!res.data?.hasAccess);
    } catch {
      setCanComment(false);
    }
  };

  const handleToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) {
      await ensureComments();
      void ensureCommentAccess();
    }
  };

  const handlePostComment = async () => {
    const text = commentBody.trim();
    if (!text || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await discoveryApi.createComment(post.id, text);
      const created = res.data;
      setComments((prev) => (prev ? [...prev, created] : [created]));
      setCommentBody('');
      setCommentCount((c) => {
        const next = c + 1;
        propagate({ commentCount: next });
        return next;
      });
    } catch (e: unknown) {
      const data =
        e && typeof e === 'object'
          ? (e as { response?: { data?: { requiresSubscription?: boolean } } })
              .response?.data
          : undefined;
      if (data?.requiresSubscription) {
        setCanComment(false);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <article className="bg-background border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-border/60">
        <Link
          href={`/pro-networx/u/${post.authorUserId}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          {post.authorAvatarUrl ? (
            <Image
              src={post.authorAvatarUrl}
              alt={post.authorDisplayName ?? 'Avatar'}
              width={36}
              height={36}
              className="rounded-full object-cover"
              unoptimized={shouldUnoptimize(post.authorAvatarUrl)}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">🎨</div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm text-foreground truncate">
              {post.authorDisplayName || 'Creator'}
            </p>
            {post.authorUsername ? (
              <p className="text-xs text-muted-foreground truncate">@{post.authorUsername}</p>
            ) : (
              post.authorHeadline && (
                <p className="text-xs text-muted-foreground truncate">{post.authorHeadline}</p>
              )
            )}
          </div>
        </Link>
        <div className="flex items-center gap-1">
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
              aria-label="Delete post"
              title="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {!isOwnPost && (
            <UserSafetyMenu
              userId={post.authorUserId}
              displayName={post.authorDisplayName}
              postId={post.id}
              onPostHidden={onHidden}
              onBlocked={onHidden}
            />
          )}
        </div>
      </div>

      <div className="relative w-full bg-muted aspect-square">
        {post.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={post.imageUrl}
            controls
            playsInline
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
          <button
            type="button"
            aria-label="Full screen"
            title="Full screen"
            className="absolute inset-x-0 top-0 bottom-14 z-10 cursor-pointer"
            onClick={() => {
              videoRef.current?.pause();
              setVideoOpen(true);
            }}
          />
          <span className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white">
            <Maximize2 className="h-4 w-4" />
          </span>
        ) : (
          <Image
            src={post.imageUrl}
            alt={post.caption || 'Post'}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 700px"
            unoptimized={shouldUnoptimize(post.imageUrl)}
          />
        )}
        {post.mediaType === 'audio' && post.audioUrl && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <audio
              ref={audioRef}
              src={post.audioUrl}
              controls
              preload="none"
              className="w-full"
            />
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
            aria-label={likedByMe ? 'Unlike' : 'Like'}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                likedByMe ? 'fill-red-500 text-red-500' : 'text-foreground',
              )}
            />
            <span className="text-foreground tabular-nums">{likeCount}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleComments}
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
            aria-label="Comments"
          >
            <MessageCircle className="h-5 w-5 text-foreground" />
            <span className="text-foreground tabular-nums">{commentCount}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
            aria-label="Share with friends"
          >
            <Send className="h-5 w-5 text-foreground" />
          </button>
          <button
            type="button"
            onClick={handleToggleBookmark}
            disabled={bookmarkBusy}
            className="ml-auto flex items-center text-sm hover:opacity-80 transition-opacity"
            aria-label={bookmarkedByMe ? 'Remove bookmark' : 'Save post'}
          >
            <Bookmark
              className={cn(
                'h-5 w-5 transition-colors',
                bookmarkedByMe ? 'fill-foreground text-foreground' : 'text-foreground',
              )}
            />
          </button>
        </div>

        {post.caption && (
          <p className="text-sm text-foreground whitespace-pre-wrap">
            <Link
              href={`/pro-networx/u/${post.authorUserId}`}
              className="font-semibold hover:underline mr-1"
            >
              {post.authorDisplayName || 'Creator'}
            </Link>
            {post.caption}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </p>

        {showComments && (
          <div className="pt-2 border-t border-border/60 space-y-3">
            {loadingComments ? (
              <p className="text-xs text-muted-foreground">Loading comments…</p>
            ) : comments && comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Be the first to comment.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {comments?.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <Link href={`/pro-networx/u/${c.authorUserId}`} className="shrink-0">
                      {c.authorAvatarUrl ? (
                        <Image
                          src={c.authorAvatarUrl}
                          alt={c.authorDisplayName ?? 'Avatar'}
                          width={24}
                          height={24}
                          className="rounded-full object-cover"
                          unoptimized={shouldUnoptimize(c.authorAvatarUrl)}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/pro-networx/u/${c.authorUserId}`}
                        className="font-semibold text-foreground hover:underline mr-1"
                      >
                        {c.authorDisplayName || 'Creator'}
                      </Link>
                      <span className="text-foreground whitespace-pre-wrap break-words">
                        {c.body}
                      </span>
                      <div>
                        {profile?.id === c.authorUserId ? (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => {
                              void discoveryApi.deleteComment(c.id).then(() => {
                                setComments((prev) => prev?.filter((item) => item.id !== c.id) ?? []);
                              }).catch(() => toast.error('Could not delete that comment.'));
                            }}
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => {
                              const reason = window.prompt('Why are you reporting this comment?');
                              if (!reason?.trim()) return;
                              void moderationApi.report({
                                targetType: 'comment',
                                targetId: c.id,
                                reason: reason.trim(),
                              }).then(() => toast.success('Report sent. An admin will review it.'))
                                .catch(() => toast.error('Could not send that report.'));
                            }}
                          >
                            Report
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canComment === false ? (
              <PaywallCard
                variant="dm"
                caption="Commenting unlocks with a Pro-Networx subscription. Reading comments is always free."
              />
            ) : (
              <div className="flex items-end gap-2">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add a comment…"
                  rows={1}
                  className="min-h-[36px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handlePostComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handlePostComment}
                  disabled={!commentBody.trim() || submittingComment}
                >
                  Post
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <SharePostDialog post={post} open={shareOpen} onOpenChange={setShareOpen} />
      {videoOpen && post.mediaType === 'video' && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Video"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            onClick={() => setVideoOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <video
            ref={fullscreenVideoRef}
            src={post.imageUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full"
          />
        </div>
      )}
    </article>
  );
}
