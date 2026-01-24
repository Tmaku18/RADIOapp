'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRadioState, Track } from './useRadioState';
import { radioApi, songsApi } from '@/lib/api';

export function RadioPlayer() {
  const { state, loadTrack, togglePlay, setVolume } = useRadioState();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Fetch current track on mount and periodically
  const fetchCurrentTrack = useCallback(async () => {
    try {
      const response = await radioApi.getCurrentTrack();
      const trackData = response.data;
      
      if (trackData && trackData.id) {
        const track: Track = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artworkUrl: trackData.artwork_url,
          audioUrl: trackData.audio_url,
          durationSeconds: trackData.duration_seconds || 180,
        };
        
        // Only load if different track
        if (!state.currentTrack || state.currentTrack.id !== track.id) {
          loadTrack(track);
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
  }, [loadTrack, state.currentTrack]);

  useEffect(() => {
    fetchCurrentTrack();
    
    // Poll for track changes every 10 seconds
    const interval = setInterval(fetchCurrentTrack, 10000);
    
    return () => clearInterval(interval);
  }, [fetchCurrentTrack]);

  const handleSkip = async () => {
    try {
      const response = await radioApi.getNextTrack();
      const trackData = response.data;
      
      if (trackData && trackData.id) {
        const track: Track = {
          id: trackData.id,
          title: trackData.title,
          artistName: trackData.artist_name,
          artworkUrl: trackData.artwork_url,
          audioUrl: trackData.audio_url,
          durationSeconds: trackData.duration_seconds || 180,
        };
        loadTrack(track);
        
        // Report skip
        await radioApi.reportPlay({ songId: trackData.id, skipped: true });
      }
    } catch (error) {
      console.error('Failed to skip:', error);
    }
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

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Album Art */}
      <div className="aspect-square bg-gradient-to-br from-purple-400 to-indigo-500 relative">
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
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {state.error}
          </div>
        )}

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 truncate">
            {state.currentTrack?.title || 'No track playing'}
          </h2>
          <p className="text-gray-600 truncate">
            {state.currentTrack?.artistName || 'Unknown artist'}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-600 transition-all duration-300"
              style={{
                width: `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
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

          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            disabled={!state.currentTrack || state.isLoading}
            className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {state.isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            disabled={!state.currentTrack || state.isLoading}
            className="p-3 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
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
            className="w-32 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600"
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
    </div>
  );
}
