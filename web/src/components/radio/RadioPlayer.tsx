'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRadioState, Track } from './useRadioState';
import { prospectorApi, radioApi, leaderboardApi, analyticsApi, paymentsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type PinnedCatalyst = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
};

function roleToLabel(role: string): string {
  switch (role) {
    case 'cover_art':
      return 'Cover art';
    case 'video':
      return 'Video';
    case 'production':
      return 'Production';
    case 'photo':
      return 'Photo';
    default:
      return 'Credits';
  }
}

export function RadioPlayer() {
  const { profile } = useAuth();
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isQuickBuying, setIsQuickBuying] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [showJumpToLive, setShowJumpToLive] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [noContent, setNoContent] = useState(false);
  const [noContentMessage, setNoContentMessage] = useState<string | null>(null);
  const [isLiveBroadcast, setIsLiveBroadcast] = useState(false);
  const [artistLiveNow, setArtistLiveNow] = useState<{
    sessionId: string;
    status: 'starting' | 'live';
    currentViewers?: number;
  } | null>(null);
  const [pinnedCatalysts, setPinnedCatalysts] = useState<PinnedCatalyst[]>([]);
  const lastVotedPlayIdRef = useRef<string | null>(null);
  const lastServerPosition = useRef(0);
  const isFetchingNextTrack = useRef(false);

  const isProspector = profile?.role === 'listener';
  const streamTokenRef = useRef<string>(Math.random().toString(36).slice(2));
  const lastHeartbeatSessionIdRef = useRef<string | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const [refineryOpen, setRefineryOpen] = useState(false);
  const [refinerySongId, setRefinerySongId] = useState<string | null>(null);
  const [refineScore, setRefineScore] = useState<number>(8);
  const [whereListen, setWhereListen] = useState('');
  const [remindsOf, setRemindsOf] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmittingRefinery, setIsSubmittingRefinery] = useState(false);
  
  // Refs for accessing radio functions in callback
  const loadTrackRef = useRef<typeof loadTrack | null>(null);
  const syncToPositionRef = useRef<typeof syncToPosition | null>(null);
  const playRef = useRef<typeof play | null>(null);

  // Callback for when track ends - immediately fetch next track
  const handleTrackEnded = useCallback(async () => {
    // Prevent multiple concurrent fetches
    if (isFetchingNextTrack.current) return;
    isFetchingNextTrack.current = true;
    
    try {
      // Immediately fetch and play next track
      const response = await radioApi.getCurrentTrack();
      const trackData = response.data;
      
      // Check for no_content flag
      if (trackData?.no_content) {
        setNoContent(true);
        setNoContentMessage(trackData.message || "No ore's are currently available.");
        setArtistLiveNow(null);
        setPinnedCatalysts([]);
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setIsLiveBroadcast(!!trackData?.is_live);
      setArtistLiveNow(trackData?.artist_live_now ?? null);
      setPinnedCatalysts(Array.isArray(trackData?.pinned_catalysts) ? trackData.pinned_catalysts : []);
      
      if (trackData && trackData.id) {
        const audioUrl = trackData.audio_url;
        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
          console.warn('Next track has no audio URL, fetching again');
          isFetchingNextTrack.current = false;
          setTimeout(() => handleTrackEnded(), 500);
          return;
        }
        const track: Track = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artistId: trackData.artist_id ?? null,
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
          playId: trackData.play_id ?? null,
        };
        
        const serverPosition = trackData.position_seconds || 0;
        lastServerPosition.current = serverPosition;
        
        // Load and immediately play the next track (user has already interacted)
        if (loadTrackRef.current) loadTrackRef.current(track);
        if (syncToPositionRef.current) syncToPositionRef.current(serverPosition);
        if (playRef.current) {
          try {
            await playRef.current();
          } catch (err) {
            console.log('Failed to auto-play next track:', err);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch next track:', error);
    } finally {
      isFetchingNextTrack.current = false;
    }
  }, []);

  const handleCheckIn = async () => {
    if (!isProspector || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      await prospectorApi.checkIn({ sessionId: lastHeartbeatSessionIdRef.current });
      setShowCheckInPrompt(false);
    } catch (e) {
      console.error('Check-in failed', e);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const submitRefinery = async () => {
    if (!isProspector || !refinerySongId || isSubmittingRefinery) return;
    setIsSubmittingRefinery(true);
    try {
      await prospectorApi.submitRefinement({ songId: refinerySongId, score: refineScore });
      await prospectorApi.submitSurvey({
        songId: refinerySongId,
        responses: {
          whereListen,
          remindsOf,
          comments,
        },
      });
      setRefineryOpen(false);
      setRefinerySongId(null);
    } catch (e) {
      console.error('Failed to submit refinery data', e);
    } finally {
      setIsSubmittingRefinery(false);
    }
  };

  const { 
    state, 
    loadTrack, 
    togglePlay, 
    setVolume,
    syncToPosition,
    softPause,
    softResume,
    jumpToLive,
    needsJumpToLive,
    play,
  } = useRadioState({ onTrackEnded: handleTrackEnded });

  // Keep refs in sync with latest functions
  useEffect(() => {
    loadTrackRef.current = loadTrack;
    syncToPositionRef.current = syncToPosition;
    playRef.current = play;
  }, [loadTrack, syncToPosition, play]);

  // Open refinery prompt when a new ore starts (rate + survey the previous ore).
  useEffect(() => {
    const currentId = state.currentTrack?.id ?? null;
    if (!isProspector) {
      lastTrackIdRef.current = currentId;
      return;
    }

    const previousId = lastTrackIdRef.current;
    if (previousId && currentId && previousId !== currentId) {
      setRefinerySongId(previousId);
      setRefineScore(8);
      setWhereListen('');
      setRemindsOf('');
      setComments('');
      setRefineryOpen(true);
    }
    lastTrackIdRef.current = currentId;
  }, [isProspector, state.currentTrack?.id]);

  // Heartbeat: every 30s while playing to verify listening (Yield accrual is server-side gated by check-ins).
  useEffect(() => {
    if (!isProspector) return;
    if (!state.currentTrack?.id) return;
    if (!state.isPlaying) return;

    let cancelled = false;
    const send = async () => {
      try {
        const res = await radioApi.sendHeartbeat({
          streamToken: streamTokenRef.current,
          songId: state.currentTrack!.id,
          timestamp: new Date().toISOString(),
        });
        if (cancelled) return;
        const sessionId = res?.data?.sessionId;
        lastHeartbeatSessionIdRef.current = typeof sessionId === 'string' ? sessionId : null;

        const needs = !!res?.data?.requiresCheckIn;
        if (needs) setShowCheckInPrompt(true);
      } catch {
        // Heartbeat failures should not break playback UX.
      }
    };

    send();
    const interval = setInterval(send, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isProspector, state.currentTrack?.id, state.isPlaying]);

  // Fetch current track on mount and periodically
  const fetchCurrentTrack = useCallback(async (shouldSync = false, autoPlay = false) => {
    try {
      const response = await radioApi.getCurrentTrack();
      const trackData = response.data;
      
      // Check for no_content flag (or backend returned it on error)
      if (trackData?.no_content) {
        setNoContent(true);
        setNoContentMessage(trackData.message || "No ore's are currently available.");
        setArtistLiveNow(null);
        setPinnedCatalysts([]);
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setIsLiveBroadcast(!!trackData?.is_live);
      setArtistLiveNow(trackData?.artist_live_now ?? null);
      setPinnedCatalysts(Array.isArray(trackData?.pinned_catalysts) ? trackData.pinned_catalysts : []);
      
      if (trackData && trackData.id) {
        const audioUrl = trackData.audio_url;
        if (!audioUrl || typeof audioUrl !== 'string' || !audioUrl.trim()) {
          setNoContent(true);
          setNoContentMessage('Track has no playable source.');
          return;
        }
        const track: Track = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artistId: trackData.artist_id ?? null,
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
          playId: trackData.play_id ?? null,
        };
        
        // Save server position for sync
        const serverPosition = trackData.position_seconds || 0;
        lastServerPosition.current = serverPosition;
        
        // Only load if different track
        if (!state.currentTrack || state.currentTrack.id !== track.id) {
          loadTrack(track);
          // Sync position
          syncToPosition(serverPosition);
          // Only auto-play if user has already interacted (clicked play before)
          if (autoPlay && hasUserInteracted) {
            requestAnimationFrame(async () => {
              try {
                await play();
              } catch (err) {
                // Autoplay was blocked - this is expected on initial load
                console.log('Autoplay blocked by browser policy');
              }
            });
          }
        } else if (shouldSync && state.isLive) {
          // Same track, just sync position (handle drift)
          syncToPosition(serverPosition);
        }
      }
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message;
      if (msg) setNoContentMessage(msg);
      else setNoContentMessage("No ore's are currently available. Please try again later.");
      setNoContent(true);
      setArtistLiveNow(null);
      setPinnedCatalysts([]);
      console.warn('Radio current track unavailable:', (error as Error)?.message || error);
    }
  }, [loadTrack, state.currentTrack, state.isLive, syncToPosition, play, hasUserInteracted]);

  // Reset vote state when play changes
  useEffect(() => {
    const playId = state.currentTrack?.playId ?? null;
    if (playId && playId !== lastVotedPlayIdRef.current) {
      setHasVoted(false);
    }
  }, [state.currentTrack?.playId]);

  // Initial fetch and periodic polling
  useEffect(() => {
    // Initial fetch - don't auto-play (wait for user interaction)
    fetchCurrentTrack(true, false);
    
    // Poll for track changes every 10 seconds
    // Auto-play only if user has already started playing
    const interval = setInterval(() => fetchCurrentTrack(true, hasUserInteracted), 10000);
    
    return () => clearInterval(interval);
  }, [fetchCurrentTrack, hasUserInteracted]);

  // Re-sync every 30 seconds to handle drift (only when live)
  useEffect(() => {
    if (!state.isLive) return;
    
    const syncInterval = setInterval(() => {
      fetchCurrentTrack(true, false); // Don't auto-play during sync, just update position
    }, 30000);
    
    return () => clearInterval(syncInterval);
  }, [state.isLive, fetchCurrentTrack]);

  // Check for "Jump to Live" state when paused
  useEffect(() => {
    if (!state.pausedAt) {
      setShowJumpToLive(false);
      return;
    }
    
    // Check every second if we've exceeded 30s pause
    const checkInterval = setInterval(() => {
      if (needsJumpToLive()) {
        setShowJumpToLive(true);
      }
    }, 1000);
    
    return () => clearInterval(checkInterval);
  }, [state.pausedAt, needsJumpToLive]);

  // Handle soft pause toggle
  const handlePauseToggle = async () => {
    // Mark that user has interacted - enables auto-play for subsequent tracks
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    
    if (state.isPlaying) {
      softPause();
    } else if (showJumpToLive) {
      // Need to jump to live
      await fetchCurrentTrack(false, true);
      await jumpToLive(lastServerPosition.current);
      setShowJumpToLive(false);
    } else {
      // Within 30s buffer, just resume
      await softResume();
    }
  };

  // Handle jump to live
  const handleJumpToLive = async () => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    await fetchCurrentTrack(false, true);
    await jumpToLive(lastServerPosition.current);
    setShowJumpToLive(false);
  };

  const handleVote = async () => {
    if (!state.currentTrack) return;
    if (isVoting || hasVoted) return;
    if (!state.currentTrack.playId) return;

    setIsVoting(true);
    try {
      await leaderboardApi.addLeaderboardLike(state.currentTrack.id, state.currentTrack.playId);
      lastVotedPlayIdRef.current = state.currentTrack.playId;
      setHasVoted(true);
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canQuickBuy =
    !!profile?.id &&
    !!state.currentTrack?.id &&
    !!state.currentTrack?.artistId &&
    profile.id === state.currentTrack.artistId;

  const handleQuickBuy = async () => {
    if (!state.currentTrack?.id || isQuickBuying) return;
    setIsQuickBuying(true);
    try {
      const res = await paymentsApi.quickAddMinutes({ songId: state.currentTrack.id });
      const url = res.data?.url;
      if (url && typeof window !== 'undefined') {
        window.location.href = url;
      }
    } catch (e) {
      console.error('Quick-buy failed', e);
    } finally {
      setIsQuickBuying(false);
    }
  };

  if (noContent) {
    return (
      <Card className="overflow-hidden">
        {/* No Content Art */}
        <div className="aspect-square bg-gradient-to-br from-gray-400 to-gray-600 relative">
          <div className="w-full h-full flex items-center justify-center flex-col gap-4 p-8">
            <span className="text-8xl">📻</span>
            <div className="text-center">
              <h3 className="text-white text-xl font-bold">No Content Available</h3>
              <p className="text-gray-200 text-sm mt-2">
                {noContentMessage || "Sorry for the inconvenience. No ore's are currently available."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-foreground">Station Offline</h2>
            <p className="text-muted-foreground">Please check back soon!</p>
          </div>
          <div className="flex items-center justify-center">
            <Button onClick={() => fetchCurrentTrack(true, false)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden glass-panel border-border/80">
      {/* Album Art — subtle signature gradient behind */}
      <div className="aspect-square bg-signature relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10" aria-hidden />
        {state.currentTrack?.artworkUrl ? (
          <img
            src={state.currentTrack.artworkUrl}
            alt={state.currentTrack.title}
            className="w-full h-full object-cover relative z-0"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative z-0">
            <span className="text-8xl">🎵</span>
          </div>
        )}
        
        {/* Loading overlay */}
        {state.isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="p-6">
        {state.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {isProspector && showCheckInPrompt && (
          <Alert className="mb-4">
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span>
                Tap the Ripple check-in to keep earning <span className="font-semibold">The Yield</span>.
              </span>
              <Button onClick={handleCheckIn} disabled={isCheckingIn} className="rounded-full">
                {isCheckingIn ? 'Checking in…' : 'Check in'}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-center mb-6">
          {isLiveBroadcast && (
            <span className="badge-live inline-flex items-center gap-1.5 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              Now Live
            </span>
          )}
          <h2 className="text-xl font-bold text-foreground truncate">
            {state.currentTrack?.title || 'No track playing'}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (state.currentTrack?.id) {
                analyticsApi.recordProfileClick(state.currentTrack.id).catch(() => {});
              }
            }}
            className="text-muted-foreground truncate text-left hover:text-foreground hover:underline transition-colors"
          >
            {state.currentTrack?.artistName || 'Unknown artist'}
          </button>
          {artistLiveNow && state.currentTrack?.artistId && (
            <div className="mt-2">
              <Link href={`/watch/${state.currentTrack.artistId}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  {artistLiveNow.status === 'starting' ? 'Stream starting…' : 'Join artist live'}
                </Button>
              </Link>
            </div>
          )}

          {pinnedCatalysts.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground flex flex-col gap-1">
              {pinnedCatalysts.slice(0, 3).map((c) => (
                <div key={`${c.userId}:${c.role}`} className="flex items-center justify-center gap-1.5">
                  <span className="uppercase tracking-wide text-[10px]">{roleToLabel(c.role)} by</span>
                  <Link
                    href={`/artist/${c.userId}`}
                    className="text-foreground/90 hover:text-foreground hover:underline"
                  >
                    {c.displayName}
                  </Link>
                </div>
              ))}
              {pinnedCatalysts.length > 3 && (
                <div className="text-[10px] opacity-80">+ {pinnedCatalysts.length - 3} more</div>
              )}
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        {canQuickBuy && (
          <div className="mb-4 flex justify-center">
            <Button onClick={handleQuickBuy} disabled={isQuickBuying || state.isLoading} className="rounded-full">
              {isQuickBuying ? 'Opening checkout…' : 'Add 5 Minutes'}
            </Button>
          </div>
        )}

        {/* LIVE Indicator */}
        <div className="flex items-center justify-center mb-4">
          {state.isLive && state.isPlaying ? (
            <span className="badge-live inline-flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-current" />
              </span>
              LIVE
            </span>
          ) : showJumpToLive ? (
            <Button onClick={handleJumpToLive} className="rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zM13 6v12l8.5-6L13 6z" />
              </svg>
              <span className="font-semibold text-sm">Jump to Live</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-full">
              <span className="font-semibold text-sm">PAUSED</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-6">
          {/* Vote Button (1 per play) */}
          <button
            onClick={handleVote}
            disabled={!state.currentTrack || isVoting || hasVoted || !state.currentTrack?.playId}
            className={`p-3 rounded-full transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              hasVoted
                ? 'bg-primary text-primary-foreground signal-glow'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-[1.03]'
            } disabled:opacity-50`}
          >
            <svg
              className="w-6 h-6"
              fill={hasVoted ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>

          {/* Pause/Resume Button (Soft Pause) */}
          <button
            onClick={handlePauseToggle}
            disabled={!state.currentTrack || state.isLoading}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
              showJumpToLive 
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {state.isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : showJumpToLive ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zM13 6v12l8.5-6L13 6z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Placeholder for symmetry (replacing skip) */}
          <div className="w-12 h-12" />
        </div>

        {/* Volume Control */}
        <div className="mt-6 flex items-center justify-center space-x-3">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={state.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <svg
            className="w-5 h-5 text-gray-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </div>
      </div>

      <Dialog open={refineryOpen} onOpenChange={setRefineryOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Refine that ore (Prospector)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refineScore">Refinement (1–10)</Label>
              <div className="flex items-center gap-3">
                <input
                  id="refineScore"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={refineScore}
                  onChange={(e) => setRefineScore(parseInt(e.target.value, 10))}
                  className="w-full"
                />
                <div className="w-10 text-right font-semibold tabular-nums">{refineScore}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whereListen">Where would you listen?</Label>
                <Input
                  id="whereListen"
                  value={whereListen}
                  onChange={(e) => setWhereListen(e.target.value)}
                  placeholder="Car, gym, party…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remindsOf">What artist does it remind you of?</Label>
                <Input
                  id="remindsOf"
                  value={remindsOf}
                  onChange={(e) => setRemindsOf(e.target.value)}
                  placeholder="Artist / vibe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Feedback (optional)</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="What clicked? What didn’t?"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRefineryOpen(false)} disabled={isSubmittingRefinery}>
              Later
            </Button>
            <Button onClick={submitRefinery} disabled={isSubmittingRefinery}>
              {isSubmittingRefinery ? 'Submitting…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
