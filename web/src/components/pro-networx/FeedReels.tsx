'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  Music2,
  Play,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  discoveryApi,
  moderationApi,
  proNetworkSubscriptionApi,
  type DiscoverFeedComment,
  type DiscoverFeedPost,
} from '@/lib/api';
import { requireAccount } from '@/lib/require-account';
import { useAuth } from '@/contexts/AuthContext';
import { usePlaybackOptional } from '@/components/playback/PlaybackProvider';
import { ModalPortal } from '@/components/ui/modal-portal';
import { UserSafetyMenu } from '@/components/safety/UserSafetyMenu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SharePostDialog } from './SharePostDialog';
import { PaywallCard } from './PaywallCard';

function shouldUnoptimize(url?: string | null): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('.supabase.co') || host.endsWith('.r2.dev')) return false;
    if (host.endsWith('r2.cloudflarestorage.com')) return false;
  } catch {
    return true;
  }
  return true;
}

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

interface FeedReelsProps {
  posts: DiscoverFeedPost[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onPostChange: (next: DiscoverFeedPost) => void;
  onPostRemoved: (postId: string) => void;
  /** Shows an X in the top-left corner. */
  onClose?: () => void;
  title?: string;
  /** Extra controls pinned to the top-right (Post, Refresh, ...). */
  topRight?: ReactNode;
  /** Shown when the feed has loaded but has no posts. */
  empty?: ReactNode;
  error?: string | null;
}

/**
 * Full-screen vertical feed, one post per screen, like Reels and TikTok.
 * Scroll, swipe, or use the arrow keys to move between posts. Videos play
 * only while they are on screen. Sound stays off until the viewer turns it on,
 * and live radio steps aside whenever a post is audible.
 */
export function FeedReels({
  posts,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onPostChange,
  onPostRemoved,
  onClose,
  title = 'Feed',
  topRight,
  empty,
  error,
}: FeedReelsProps) {
  const playback = usePlaybackOptional();
  const playbackRef = useRef(playback);
  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const audibleIds = useRef<Set<string>>(new Set());
  const radioHeld = useRef(false);

  const active = Math.max(0, Math.min(activeIndex, posts.length - 1));

  // Live radio yields while any reel is audible and resumes afterwards.
  const reportAudible = useCallback((postId: string, audible: boolean) => {
    const ids = audibleIds.current;
    if (audible) ids.add(postId);
    else ids.delete(postId);
    const shouldHold = ids.size > 0;
    if (shouldHold && !radioHeld.current) {
      radioHeld.current = true;
      playbackRef.current?.actions.holdForExternalMedia();
    } else if (!shouldHold && radioHeld.current) {
      radioHeld.current = false;
      playbackRef.current?.actions.releaseExternalMedia();
    }
  }, []);

  useEffect(() => {
    const ids = audibleIds.current;
    return () => {
      ids.clear();
      if (radioHeld.current) {
        radioHeld.current = false;
        playbackRef.current?.actions.releaseExternalMedia();
      }
    };
  }, []);

  // The page behind the feed must not scroll along with it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Track which reel fills the screen.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-reel]');
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
          const index = Number((entry.target as HTMLElement).dataset.reel);
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { root, threshold: [0.6] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [posts.length]);

  // Fetch the next page before the viewer reaches the end.
  useEffect(() => {
    if (!hasMore || loadingMore || posts.length === 0) return;
    if (active >= posts.length - 3) onLoadMore();
  }, [active, hasMore, loadingMore, onLoadMore, posts.length]);

  const goTo = useCallback((index: number) => {
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-reel="${index}"]`,
    );
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        document.querySelector(
          '[role="dialog"], [role="alertdialog"], [role="menu"]',
        )
      ) {
        return;
      }
      if (event.key === 'Escape') {
        if (commentsOpen) return;
        onClose?.();
      } else if (commentsOpen) {
        return;
      } else if (['ArrowDown', 'PageDown', 'j'].includes(event.key)) {
        event.preventDefault();
        if (active < posts.length - 1) goTo(active + 1);
      } else if (['ArrowUp', 'PageUp', 'k'].includes(event.key)) {
        event.preventDefault();
        if (active > 0) goTo(active - 1);
      } else if (event.key === 'm') {
        setMuted((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, commentsOpen, goTo, onClose, posts.length]);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[45] bg-black text-white"
        role="region"
        aria-label={title}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close feed"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <span className="text-base font-semibold drop-shadow">{title}</span>
          </div>
          {topRight && (
            <div className="pointer-events-auto flex items-center gap-2">
              {topRight}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            {error && <p className="text-sm text-red-300">{error}</p>}
            {empty ?? (
              <p className="text-white/70">No posts yet. Check back soon.</p>
            )}
          </div>
        ) : (
          <>
            <div
              ref={containerRef}
              className={cn(
                'h-full w-full snap-y snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                commentsOpen ? 'overflow-y-hidden' : 'overflow-y-scroll',
              )}
            >
              {posts.map((post, index) => (
                <section
                  key={post.id}
                  data-reel={index}
                  className="relative flex h-dvh w-full snap-start snap-always justify-center bg-black"
                >
                  <Reel
                    post={post}
                    index={index}
                    active={index === active}
                    near={Math.abs(index - active) <= 1}
                    muted={muted}
                    onMutedChange={setMuted}
                    reportAudible={reportAudible}
                    onChange={onPostChange}
                    onRemoved={onPostRemoved}
                    onCommentsOpenChange={setCommentsOpen}
                  />
                </section>
              ))}
              {loadingMore && (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex">
              <button
                type="button"
                aria-label="Previous post"
                disabled={active <= 0}
                onClick={() => goTo(active - 1)}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-30"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next post"
                disabled={active >= posts.length - 1}
                onClick={() => goTo(active + 1)}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-30"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </ModalPortal>
  );
}

interface ReelProps {
  post: DiscoverFeedPost;
  index: number;
  active: boolean;
  near: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  reportAudible: (postId: string, audible: boolean) => void;
  onChange: (next: DiscoverFeedPost) => void;
  onRemoved: (postId: string) => void;
  onCommentsOpenChange: (open: boolean) => void;
}

function RailButton({
  label,
  count,
  onClick,
  disabled,
  children,
}: {
  label: string;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 text-white drop-shadow transition active:scale-90 disabled:opacity-60"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur">
        {children}
      </span>
      {count != null && (
        <span className="text-xs font-medium tabular-nums">{count}</span>
      )}
    </button>
  );
}

function Reel({
  post,
  index,
  active,
  near,
  muted,
  onMutedChange,
  reportAudible,
  onChange,
  onRemoved,
  onCommentsOpenChange,
}: ReelProps) {
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVideo = post.mediaType === 'video';
  const isAudio = post.mediaType === 'audio' && !!post.audioUrl;
  const isOwnPost = profile?.id === post.authorUserId;
  const canDelete = isOwnPost || profile?.role === 'admin';

  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [portrait, setPortrait] = useState(true);
  const [heartVisible, setHeartVisible] = useState(false);
  const [heartKey, setHeartKey] = useState(0);
  const [captionOpen, setCaptionOpen] = useState(false);

  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [bookmarkedByMe, setBookmarkedByMe] = useState(post.bookmarkedByMe);
  const [likeBusy, setLikeBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const propagate = (patch: Partial<DiscoverFeedPost>) => {
    onChange({ ...post, ...patch });
  };

  // Video plays only while it is the post on screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!isVideo || !video) return;
    video.muted = muted;
    if (active && !userPaused) {
      const attempt = video.play();
      if (attempt) {
        attempt.catch(() => {
          // Browsers block unmuted autoplay until the viewer interacts.
          video.muted = true;
          onMutedChange(true);
          video.play().catch(() => {});
        });
      }
    } else {
      video.pause();
      if (!active) video.currentTime = 0;
    }
  }, [active, muted, userPaused, isVideo, near, onMutedChange]);

  // Audio posts play once the viewer has chosen to hear sound.
  useEffect(() => {
    const audio = audioRef.current;
    if (!isAudio || !audio) return;
    if (active && !muted && !userPaused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
      if (!active) audio.currentTime = 0;
    }
  }, [active, muted, userPaused, isAudio, near]);

  useEffect(() => {
    if (!active) setUserPaused(false);
  }, [active]);

  useEffect(() => {
    const audible = active && playing && (isVideo ? !muted : isAudio);
    reportAudible(post.id, audible);
  }, [active, playing, muted, isVideo, isAudio, post.id, reportAudible]);

  useEffect(() => {
    return () => reportAudible(post.id, false);
  }, [post.id, reportAudible]);

  useEffect(() => {
    onCommentsOpenChange(showComments);
    return () => {
      if (showComments) onCommentsOpenChange(false);
    };
  }, [showComments, onCommentsOpenChange]);

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!heartVisible) return;
    const timer = setTimeout(() => setHeartVisible(false), 750);
    return () => clearTimeout(timer);
  }, [heartVisible, heartKey]);

  const handleToggleLike = async () => {
    if (!requireAccount()) return;
    if (likeBusy) return;
    setLikeBusy(true);
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
      setLikeBusy(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!requireAccount()) return;
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
      onRemoved(post.id);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete post'));
    } finally {
      setDeleting(false);
    }
  };

  const singleTap = () => {
    if (isVideo) {
      setUserPaused((value) => !value);
    } else if (isAudio) {
      if (muted) {
        onMutedChange(false);
        setUserPaused(false);
      } else {
        setUserPaused((value) => !value);
      }
    }
  };

  // One tap pauses or plays. Two quick taps like the post.
  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (!likedByMe) void handleToggleLike();
      setHeartKey((value) => value + 1);
      setHeartVisible(true);
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      singleTap();
    }, 280);
  };

  const handleTimeUpdate = (media: HTMLMediaElement) => {
    if (media.duration > 0) setProgress(media.currentTime / media.duration);
  };

  const showPlayHint = isVideo ? userPaused : isAudio ? !playing : false;
  const longCaption = (post.caption?.length ?? 0) > 90;

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-950 md:max-w-[min(100%,calc(100dvh*9/16))]">
      <div
        className="absolute inset-0 cursor-pointer"
        onClick={handleMediaTap}
        role="presentation"
      >
        {isVideo ? (
          near ? (
            <video
              ref={videoRef}
              src={post.imageUrl}
              loop
              playsInline
              muted
              preload={active ? 'auto' : 'metadata'}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget;
                setPortrait(video.videoHeight >= video.videoWidth * 0.9);
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
              className={cn(
                'h-full w-full bg-black',
                portrait ? 'object-cover' : 'object-contain',
              )}
            />
          ) : (
            <div className="h-full w-full bg-black" />
          )
        ) : (
          <>
            <Image
              src={post.imageUrl}
              alt=""
              fill
              aria-hidden
              sizes="64px"
              className="scale-110 object-cover opacity-50 blur-2xl"
              unoptimized={shouldUnoptimize(post.imageUrl)}
            />
            <Image
              src={post.imageUrl}
              alt={post.caption || 'Post'}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-contain"
              priority={index === 0}
              unoptimized={shouldUnoptimize(post.imageUrl)}
            />
          </>
        )}
        {isAudio && near && (
          <audio
            ref={audioRef}
            src={post.audioUrl ?? undefined}
            loop
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      {showPlayHint && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-black/45 backdrop-blur">
            <Play className="h-9 w-9 fill-white text-white" />
          </span>
        </div>
      )}

      {heartVisible && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Heart
            key={heartKey}
            className="h-28 w-28 fill-red-500 text-red-500 drop-shadow-lg animate-in zoom-in-50 fade-in duration-200"
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 space-y-2">
          <Link
            href={`/pro-networx/u/${post.authorUserId}`}
            className="inline-flex max-w-full items-center gap-2"
          >
            {post.authorAvatarUrl ? (
              <Image
                src={post.authorAvatarUrl}
                alt={post.authorDisplayName ?? 'Avatar'}
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full border border-white/60 object-cover"
                unoptimized={shouldUnoptimize(post.authorAvatarUrl)}
              />
            ) : (
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
                🎨
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold drop-shadow">
                {post.authorDisplayName || 'Creator'}
              </span>
              {(post.authorUsername || post.authorHeadline) && (
                <span className="block truncate text-xs text-white/75">
                  {post.authorUsername
                    ? `@${post.authorUsername}`
                    : post.authorHeadline}
                </span>
              )}
            </span>
          </Link>
          {post.caption && (
            <button
              type="button"
              onClick={() => longCaption && setCaptionOpen((value) => !value)}
              className="block max-h-[40dvh] w-full overflow-y-auto text-left text-sm drop-shadow"
              aria-expanded={captionOpen}
            >
              <span
                className={cn(
                  'block whitespace-pre-wrap break-words',
                  !captionOpen && 'line-clamp-2',
                )}
              >
                {post.caption}
              </span>
            </button>
          )}
          {isAudio && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs backdrop-blur">
              <Music2 className="h-3.5 w-3.5" />
              {muted ? 'Tap to play audio' : 'Audio post'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-4 pb-1">
          <RailButton
            label={likedByMe ? 'Unlike' : 'Like'}
            count={likeCount}
            onClick={() => void handleToggleLike()}
            disabled={likeBusy}
          >
            <Heart
              className={cn(
                'h-6 w-6 transition-colors',
                likedByMe ? 'fill-red-500 text-red-500' : 'text-white',
              )}
            />
          </RailButton>
          <RailButton
            label="Comments"
            count={commentCount}
            onClick={() => setShowComments(true)}
          >
            <MessageCircle className="h-6 w-6" />
          </RailButton>
          <RailButton label="Share with friends" onClick={() => setShareOpen(true)}>
            <Send className="h-6 w-6" />
          </RailButton>
          <RailButton
            label={bookmarkedByMe ? 'Remove bookmark' : 'Save post'}
            onClick={() => void handleToggleBookmark()}
            disabled={bookmarkBusy}
          >
            <Bookmark
              className={cn(
                'h-6 w-6',
                bookmarkedByMe ? 'fill-white text-white' : 'text-white',
              )}
            />
          </RailButton>
          {(isVideo || isAudio) && (
            <RailButton
              label={muted ? 'Turn sound on' : 'Turn sound off'}
              onClick={() => onMutedChange(!muted)}
            >
              {muted ? (
                <VolumeX className="h-6 w-6" />
              ) : (
                <Volume2 className="h-6 w-6" />
              )}
            </RailButton>
          )}
          {canDelete && (
            <RailButton
              label="Delete post"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              <Trash2 className="h-5 w-5" />
            </RailButton>
          )}
          {!isOwnPost && (
            <UserSafetyMenu
              userId={post.authorUserId}
              displayName={post.authorDisplayName}
              postId={post.id}
              onPostHidden={() => onRemoved(post.id)}
              onBlocked={() => onRemoved(post.id)}
              buttonClassName="h-11 w-11 shrink-0 rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/55 hover:text-white"
            />
          )}
        </div>
      </div>

      {(isVideo || isAudio) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/20">
          <div
            className="h-full bg-white"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      )}

      {showComments && (
        <ReelComments
          postId={post.id}
          onClose={() => setShowComments(false)}
          onCountChange={(delta) => {
            setCommentCount((count) => {
              const next = Math.max(0, count + delta);
              propagate({ commentCount: next });
              return next;
            });
          }}
        />
      )}

      <SharePostDialog post={post} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

function ReelComments({
  postId,
  onClose,
  onCountChange,
}: {
  postId: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<DiscoverFeedComment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Commenting is a paid Pro-Networx feature; null means not checked yet.
  const [canComment, setCanComment] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    discoveryApi
      .listComments(postId, { limit: 50 })
      .then((res) => {
        if (alive) setComments(res.data?.items ?? []);
      })
      .catch(() => {
        if (alive) setComments([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    proNetworkSubscriptionApi
      .getAccess()
      .then((res) => {
        if (alive) setCanComment(!!res.data?.hasAccess);
      })
      .catch(() => {
        if (alive) setCanComment(false);
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePost = async () => {
    if (!requireAccount()) return;
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await discoveryApi.createComment(postId, text);
      const created = res.data;
      setComments((prev) => (prev ? [...prev, created] : [created]));
      setBody('');
      onCountChange(1);
    } catch (e: unknown) {
      const data =
        e && typeof e === 'object'
          ? (e as { response?: { data?: { requiresSubscription?: boolean } } })
              .response?.data
          : undefined;
      if (data?.requiresSubscription) setCanComment(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col justify-end bg-black/55"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[72%] min-h-[45%] flex-col rounded-t-2xl bg-background text-foreground"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Comments"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Comments</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading comments…</p>
          ) : comments && comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Be the first to comment.</p>
          ) : (
            <ul className="space-y-3">
              {comments?.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <Link
                    href={`/pro-networx/u/${c.authorUserId}`}
                    className="shrink-0"
                  >
                    {c.authorAvatarUrl ? (
                      <Image
                        src={c.authorAvatarUrl}
                        alt={c.authorDisplayName ?? 'Avatar'}
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-full object-cover"
                        unoptimized={shouldUnoptimize(c.authorAvatarUrl)}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pro-networx/u/${c.authorUserId}`}
                      className="mr-1 font-semibold hover:underline"
                    >
                      {c.authorDisplayName || 'Creator'}
                    </Link>
                    <span className="whitespace-pre-wrap break-words">{c.body}</span>
                    <div>
                      {profile?.id === c.authorUserId ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => {
                            void discoveryApi
                              .deleteComment(c.id)
                              .then(() => {
                                setComments(
                                  (prev) =>
                                    prev?.filter((item) => item.id !== c.id) ?? [],
                                );
                                onCountChange(-1);
                              })
                              .catch(() => toast.error('Could not delete that comment.'));
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => {
                            const reason = window.prompt(
                              'Why are you reporting this comment?',
                            );
                            if (!reason?.trim()) return;
                            void moderationApi
                              .report({
                                targetType: 'comment',
                                targetId: c.id,
                                reason: reason.trim(),
                              })
                              .then(() =>
                                toast.success('Report sent. An admin will review it.'),
                              )
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
        </div>

        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {canComment === false ? (
            <PaywallCard
              variant="dm"
              caption="Commenting unlocks with a Pro-Networx subscription. Reading comments is always free."
            />
          ) : (
            <div className="flex items-end gap-2">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Add a comment…"
                rows={1}
                className="min-h-[36px] resize-none"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handlePost();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => void handlePost()}
                disabled={!body.trim() || submitting}
              >
                Post
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
