import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

// Constants for queue state management
const QUEUE_STATE_KEY = 'global_radio_state';

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

  async getCurrentTrack() {
    const supabase = getSupabaseClient();
    
    const queueState = await this.getQueueState();
    
    if (!queueState || !queueState.song_id) {
      return null;
    }

    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('id', queueState.song_id)
      .single();

    return data;
  }

  async getNextTrack(): Promise<any> {
    const supabase = getSupabaseClient();

    // Get current state to avoid repeating the same song immediately
    const currentState = await this.getQueueState();
    const currentSongId = currentState?.song_id;

    // Get all approved songs with credits > 0
    let query = supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0)
      .order('created_at', { ascending: true });

    // Exclude current song if one is playing
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
   * Internal method to handle playing a song: update credits, log play, update queue state.
   */
  private async playSong(song: any) {
    const supabase = getSupabaseClient();

    // Calculate priority score based on engagement
    const priorityScore = this.calculatePriorityScore(song);

    // Update current playing state in database
    await this.setCurrentSong(song.id, priorityScore);

    // Decrement credits
    await supabase
      .from('songs')
      .update({
        credits_remaining: song.credits_remaining - 1,
        play_count: (song.play_count || 0) + 1,
      })
      .eq('id', song.id);

    // Log play
    await supabase.from('plays').insert({
      song_id: song.id,
      played_at: new Date().toISOString(),
    });

    return song;
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
