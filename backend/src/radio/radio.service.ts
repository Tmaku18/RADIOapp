import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

// Default song duration if not specified (3 minutes in seconds)
const DEFAULT_DURATION_SECONDS = 180;
// Buffer time before song ends to allow for network latency (2 seconds)
const SONG_END_BUFFER_MS = 2000;

@Injectable()
export class RadioService {
  /**
   * Get or create a queue state record in the database.
   * This ensures we have persistent state across server restarts.
   */
  private async getQueueState() {
    const supabase = getSupabaseClient();
    
    const { data: existing } = await supabase
      .from('rotation_queue')
      .select('*')
      .eq('position', 0) // Use position 0 as the current playing state
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return existing;
  }

  /**
   * Update the current playing song in the database.
   */
  private async setCurrentSong(songId: string, priorityScore: number = 0) {
    const supabase = getSupabaseClient();
    
    // Upsert the current state - delete old and insert new
    await supabase
      .from('rotation_queue')
      .delete()
      .eq('position', 0);

    await supabase
      .from('rotation_queue')
      .insert({
        song_id: songId,
        priority_score: priorityScore,
        position: 0,
        played_at: new Date().toISOString(),
      });
  }

  /**
   * Get the current track with timing information for client synchronization.
   * Returns the song with started_at, server_time, and time_remaining_ms.
   */
  async getCurrentTrack() {
    const supabase = getSupabaseClient();
    const now = Date.now();
    
    const queueState = await this.getQueueState();
    
    if (!queueState || !queueState.song_id) {
      return null;
    }

    const { data: song } = await supabase
      .from('songs')
      .select('*')
      .eq('id', queueState.song_id)
      .single();

    if (!song) {
      return null;
    }

    // Calculate timing information
    const startedAt = new Date(queueState.played_at).getTime();
    const durationMs = (song.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
    const endTime = startedAt + durationMs;
    const timeRemainingMs = Math.max(0, endTime - now);

    return {
      ...song,
      is_playing: timeRemainingMs > 0,
      started_at: queueState.played_at,
      server_time: new Date(now).toISOString(),
      time_remaining_ms: timeRemainingMs,
      // Position in seconds for seeking
      position_seconds: Math.floor((now - startedAt) / 1000),
    };
  }

  /**
   * Get the next track for the global radio stream.
   * 
   * IMPORTANT: This implements global synchronization:
   * - If a song is currently playing, returns the same song with timing info
   * - Only picks a new song and deducts credits when the current song ends
   * - All listeners hear the same song at the same time
   */
  async getNextTrack(): Promise<any> {
    const supabase = getSupabaseClient();
    const now = Date.now();

    // Get current state
    const currentState = await this.getQueueState();
    
    // Check if there's a song currently playing
    if (currentState?.song_id && currentState?.played_at) {
      const { data: currentSong } = await supabase
        .from('songs')
        .select('*')
        .eq('id', currentState.song_id)
        .single();

      if (currentSong) {
        const startedAt = new Date(currentState.played_at).getTime();
        const durationMs = (currentSong.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
        const endTime = startedAt + durationMs;
        const timeRemainingMs = endTime - now;

        // If song is still playing (with buffer), return it without picking a new one
        if (timeRemainingMs > SONG_END_BUFFER_MS) {
          return {
            ...currentSong,
            is_playing: true,
            started_at: currentState.played_at,
            server_time: new Date(now).toISOString(),
            time_remaining_ms: timeRemainingMs,
            position_seconds: Math.floor((now - startedAt) / 1000),
          };
        }
      }
    }

    // Current song has ended (or no song playing) - pick a new one
    const currentSongId = currentState?.song_id;

    // Get all approved songs with credits > 0
    let query = supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0)
      .order('created_at', { ascending: true });

    // Exclude current song to avoid immediate repeat
    if (currentSongId) {
      query = query.neq('id', currentSongId);
    }

    const { data: songs } = await query.limit(1);

    // If no other songs available, check if current song can repeat
    if (!songs || songs.length === 0) {
      if (currentSongId) {
        const { data: currentSong } = await supabase
          .from('songs')
          .select('*')
          .eq('id', currentSongId)
          .eq('status', 'approved')
          .gt('credits_remaining', 0)
          .single();
        
        if (currentSong) {
          // Allow repeat if it's the only song with credits
          return await this.playSong(currentSong);
        }
      }
      return null;
    }

    const nextSong = songs[0];
    return await this.playSong(nextSong);
  }

  /**
   * Internal method to handle playing a NEW song.
   * This is called ONLY when the current song ends.
   * Credits are deducted once per song play cycle, not per listener.
   */
  private async playSong(song: any) {
    const supabase = getSupabaseClient();
    const now = Date.now();
    const startedAt = new Date(now).toISOString();

    // Calculate priority score based on engagement
    const priorityScore = this.calculatePriorityScore(song);

    // Update current playing state in database
    await this.setCurrentSong(song.id, priorityScore);

    // Decrement credits (ONLY happens once per song cycle)
    await supabase
      .from('songs')
      .update({
        credits_remaining: song.credits_remaining - 1,
        play_count: (song.play_count || 0) + 1,
      })
      .eq('id', song.id);

    // Log play (once per song broadcast)
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: startedAt,
    });

    // Return song with timing information
    const durationMs = (song.duration_seconds || DEFAULT_DURATION_SECONDS) * 1000;
    
    return {
      ...song,
      is_playing: true,
      started_at: startedAt,
      server_time: startedAt,
      time_remaining_ms: durationMs,
      position_seconds: 0,
    };
  }

  /**
   * Calculate a priority score based on engagement metrics.
   * Higher scores = better engagement.
   */
  private calculatePriorityScore(song: any): number {
    const likeCount = song.like_count || 0;
    const skipCount = song.skip_count || 0;
    const playCount = song.play_count || 1;
    
    // Simple engagement formula: likes increase score, skips decrease it
    // Normalized by play count to not penalize new songs
    const skipRate = playCount > 0 ? skipCount / playCount : 0;
    const likeRate = playCount > 0 ? likeCount / playCount : 0;
    
    return (likeRate * 100) - (skipRate * 50);
  }

  async reportPlay(songId: string, skipped: boolean = false) {
    const supabase = getSupabaseClient();

    await supabase.from('plays').insert({
      song_id: songId,
      skipped,
      played_at: new Date().toISOString(),
    });

    if (skipped) {
      // Get current skip count and increment
      const { data: song } = await supabase
        .from('songs')
        .select('skip_count')
        .eq('id', songId)
        .single();

      if (song) {
        await supabase
          .from('songs')
          .update({
            skip_count: (song.skip_count || 0) + 1,
          })
          .eq('id', songId);
      }
    }
  }

  /**
   * Get upcoming songs in the queue (for preview/admin purposes).
   */
  async getUpcomingQueue(limit: number = 10) {
    const supabase = getSupabaseClient();

    const currentState = await this.getQueueState();
    const currentSongId = currentState?.song_id;

    let query = supabase
      .from('songs')
      .select('id, title, artist_name, artwork_url, credits_remaining, play_count, like_count')
      .eq('status', 'approved')
      .gt('credits_remaining', 0)
      .order('created_at', { ascending: true });

    if (currentSongId) {
      query = query.neq('id', currentSongId);
    }

    const { data: songs } = await query.limit(limit);
    
    return songs || [];
  }

  /**
   * Clear the current queue state (useful for admin operations).
   */
  async clearQueueState() {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('rotation_queue')
      .delete()
      .eq('position', 0);
      
    return { cleared: true };
  }
}
