'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRadioState, Track } from './useRadioState';
import { radioApi, songsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RadioPlayer() {
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [showJumpToLive, setShowJumpToLive] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [noContent, setNoContent] = useState(false);
  const [noContentMessage, setNoContentMessage] = useState<string | null>(null);
  const [isLiveBroadcast, setIsLiveBroadcast] = useState(false);
  const lastServerPosition = useRef(0);
  const isFetchingNextTrack = useRef(false);
  
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
        setNoContentMessage(trackData.message || 'No songs are currently available.');
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setIsLiveBroadcast(!!trackData?.is_live);
      
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
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
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

  // Fetch current track on mount and periodically
  const fetchCurrentTrack = useCallback(async (shouldSync = false, autoPlay = false) => {
    try {
      const response = await radioApi.getCurrentTrack();
      const trackData = response.data;
      
      // Check for no_content flag
      if (trackData?.no_content) {
        setNoContent(true);
        setNoContentMessage(trackData.message || 'No songs are currently available.');
        return;
      }
      
      // Reset no_content state if we have content
      setNoContent(false);
      setNoContentMessage(null);
      setIsLiveBroadcast(!!trackData?.is_live);
      
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
          artworkUrl: trackData.artwork_url,
          audioUrl,
          durationSeconds: trackData.duration_seconds || 180,
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

        // Check like status
        try {
          const likeResponse = await songsApi.getLikeStatus(track.id);
          setIsLiked(likeResponse.data?.liked || false);
        } catch {
          // Ignore like status errors
        }
      }
    } catch (error) {
      console.error('Failed to fetch current track:', error);
    }
  }, [loadTrack, state.currentTrack, state.isLive, syncToPosition, play, hasUserInteracted]);

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

  const handleLike = async () => {
    if (!state.currentTrack || isLoadingLike) return;
    
    setIsLoadingLike(true);
    try {
      if (isLiked) {
        await songsApi.unlike(state.currentTrack.id);
        setIsLiked(false);
      } else {
        await songsApi.like(state.currentTrack.id);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLoadingLike(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                {noContentMessage || 'Sorry for the inconvenience. No songs are currently available.'}
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
    <Card className="overflow-hidden">
      {/* Album Art */}
      <div className="aspect-square bg-gradient-to-br from-primary/80 to-primary relative">
        {state.currentTrack?.artworkUrl ? (
          <img
            src={state.currentTrack.artworkUrl}
            alt={state.currentTrack.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl">🎵</span>
          </div>
        )}
        
        {/* Loading overlay */}
        {state.isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
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

        <div className="text-center mb-6">
          {isLiveBroadcast && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-medium mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Live broadcast
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground truncate">
            {state.currentTrack?.title || 'No track playing'}
          </h2>
          <p className="text-gray-600 truncate">
            {state.currentTrack?.artistName || 'Unknown artist'}
          </p>
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

        {/* LIVE Indicator */}
        <div className="flex items-center justify-center mb-4">
          {state.isLive && state.isPlaying ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-semibold text-sm">LIVE</span>
            </div>
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
          {/* Like Button */}
          <button
            onClick={handleLike}
            disabled={!state.currentTrack || isLoadingLike}
            className={`p-3 rounded-full transition-colors ${
              isLiked
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
            } disabled:opacity-50`}
          >
            <svg
              className="w-6 h-6"
              fill={isLiked ? 'currentColor' : 'none'}
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
    </Card>
  );
}
