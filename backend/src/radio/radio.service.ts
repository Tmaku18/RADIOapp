import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class RadioService {
  private currentSongId: string | null = null;

  async getCurrentTrack() {
    if (!this.currentSongId) {
      return null;
    }

    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('songs')
      .select('*')
      .eq('id', this.currentSongId)
      .single();

    return data;
  }

  async getNextTrack(): Promise<any> {
    const supabase = getSupabaseClient();

    // Simple FIFO queue: Get oldest approved song with credits > 0
    const { data: songs } = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .gt('credits_remaining', 0)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!songs || songs.length === 0) {
      return null;
    }

    const nextSong = songs[0];
    this.currentSongId = nextSong.id;

    // Decrement credits
    await supabase
      .from('songs')
      .update({
        credits_remaining: nextSong.credits_remaining - 1,
        play_count: (nextSong.play_count || 0) + 1,
      })
      .eq('id', nextSong.id);

    // Log play
    await supabase.from('plays').insert({
      song_id: nextSong.id,
      played_at: new Date().toISOString(),
    });

    return nextSong;
  }

  async reportPlay(songId: string, skipped: boolean = false) {
    const supabase = getSupabaseClient();

    await supabase.from('plays').insert({
      song_id: songId,
      skipped,
      played_at: new Date().toISOString(),
    });

    if (skipped) {
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
}
