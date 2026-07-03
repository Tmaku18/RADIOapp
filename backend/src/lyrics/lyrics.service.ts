import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { signSongAudioUrl } from '../common/song-audio.util';
import {
  AlignedWord,
  LyricsAlignmentProvider,
} from './lyrics-alignment.provider';
import { ElevenLabsAlignmentProvider } from './elevenlabs-alignment.provider';

export interface TimedLine {
  startMs: number;
  endMs: number;
  text: string;
}

export interface LyricsRecord {
  plainText: string | null;
  timedLines: TimedLine[] | null;
  provider: string | null;
  status: 'none' | 'pending' | 'ready' | 'failed';
  updatedAt: string | null;
}

/**
 * Owns the song_lyrics table: saving artist lyrics and force-aligning them to
 * the audio in the background (automatic closed captions). Alignment runs like
 * sample generation — fire-and-forget after upload, never blocking the caller.
 */
@Injectable()
export class LyricsService {
  private readonly logger = new Logger(LyricsService.name);
  private readonly provider: LyricsAlignmentProvider;

  constructor(elevenLabs: ElevenLabsAlignmentProvider) {
    // Swap the injected provider here to change alignment vendors.
    this.provider = elevenLabs;
  }

  async getLyrics(songId: string): Promise<LyricsRecord> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('song_lyrics')
      .select('plain_text, timed_lines, provider, status, updated_at')
      .eq('song_id', songId)
      .maybeSingle();

    if (error) {
      if (
        (error as { code?: string }).code === '42P01' ||
        (error.message ?? '').toLowerCase().includes('song_lyrics')
      ) {
        return this.emptyRecord();
      }
      throw new BadRequestException(`Failed to fetch lyrics: ${error.message}`);
    }
    if (!data) return this.emptyRecord();
    return {
      plainText: data.plain_text ?? null,
      timedLines: (data.timed_lines as TimedLine[] | null) ?? null,
      provider: data.provider ?? null,
      status: (data.status as LyricsRecord['status']) ?? 'none',
      updatedAt: data.updated_at ?? null,
    };
  }

  /**
   * Save lyrics for a song. Explicit `timedLines` are treated as a manual
   * sync and stored as-is; otherwise a non-empty `plainText` queues automatic
   * alignment in the background (when the provider is configured).
   */
  async upsertLyrics(
    songId: string,
    input: { plainText?: string; timedLines?: TimedLine[] | null },
  ): Promise<LyricsRecord> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const row: Record<string, unknown> = { song_id: songId, updated_at: now };

    const hasManualTimedLines =
      Array.isArray(input.timedLines) && input.timedLines.length > 0;
    const plainText =
      input.plainText !== undefined ? input.plainText.trim() : undefined;

    if (input.plainText !== undefined) {
      row.plain_text = plainText || null;
    }

    if (input.timedLines !== undefined) {
      row.timed_lines = hasManualTimedLines ? input.timedLines : null;
    }

    let queueAlignment = false;
    if (hasManualTimedLines) {
      // Artist supplied their own timings; don't overwrite them.
      row.provider = 'manual';
      row.status = 'ready';
      row.aligned_at = now;
      row.error = null;
    } else if (input.plainText !== undefined) {
      if (plainText) {
        if (this.provider.isConfigured()) {
          row.status = 'pending';
          queueAlignment = true;
        } else {
          // No aligner available: plain lyrics still display, just unsynced.
          row.status = 'none';
        }
        // Text changed — any previously aligned lines no longer match it.
        row.timed_lines = null;
        row.error = null;
      } else {
        // Lyrics cleared.
        row.status = 'none';
        row.timed_lines = null;
        row.error = null;
      }
    }

    const { data, error } = await supabase
      .from('song_lyrics')
      .upsert(row, { onConflict: 'song_id' })
      .select('plain_text, timed_lines, provider, status, updated_at')
      .single();

    if (error) {
      throw new BadRequestException(`Failed to save lyrics: ${error.message}`);
    }

    if (queueAlignment) {
      this.alignLyricsInBackground(songId);
    }

    return {
      plainText: data.plain_text ?? null,
      timedLines: (data.timed_lines as TimedLine[] | null) ?? null,
      provider: data.provider ?? null,
      status: (data.status as LyricsRecord['status']) ?? 'none',
      updatedAt: data.updated_at ?? null,
    };
  }

  /**
   * Fire-and-forget forced alignment, mirroring generateSampleInBackground.
   * Failures mark the row `failed` but keep the plain lyrics usable.
   */
  alignLyricsInBackground(songId: string): void {
    void this.alignLyrics(songId).catch((err) => {
      this.logger.warn(
        `Lyrics alignment failed for song ${songId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private async alignLyrics(songId: string): Promise<void> {
    const supabase = getSupabaseClient();
    try {
      const { data: lyricsRow } = await supabase
        .from('song_lyrics')
        .select('plain_text')
        .eq('song_id', songId)
        .maybeSingle();
      const plainText = (lyricsRow?.plain_text ?? '').trim();
      if (!plainText) return;

      const { data: song } = await supabase
        .from('songs')
        .select('audio_url')
        .eq('id', songId)
        .single();
      if (!song?.audio_url) {
        throw new Error('Song has no audio to align against');
      }

      const signedUrl =
        (await signSongAudioUrl(song.audio_url)) ?? song.audio_url;
      const audioRes = await fetch(signedUrl);
      if (!audioRes.ok) {
        throw new Error(
          `Failed to download song audio: ${audioRes.status} ${audioRes.statusText}`,
        );
      }
      const audio = Buffer.from(await audioRes.arrayBuffer());
      if (!audio.length) throw new Error('Downloaded song audio is empty');

      const result = await this.provider.align(audio, plainText);
      const timedLines = groupWordsIntoLines(plainText, result.words);
      if (!timedLines.length) {
        throw new Error('Alignment produced no caption lines');
      }

      await supabase
        .from('song_lyrics')
        .update({
          timed_lines: timedLines,
          provider: result.provider,
          status: 'ready',
          aligned_at: new Date().toISOString(),
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('song_id', songId);
      this.logger.log(
        `Aligned lyrics for song ${songId}: ${timedLines.length} lines via ${result.provider}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase
        .from('song_lyrics')
        .update({
          status: 'failed',
          error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('song_id', songId);
      throw err;
    }
  }

  private emptyRecord(): LyricsRecord {
    return {
      plainText: null,
      timedLines: null,
      provider: null,
      status: 'none',
      updatedAt: null,
    };
  }
}

/**
 * Group provider word timings back into the artist's lyric lines.
 *
 * The aligner was given the exact lyrics text, so its word stream follows the
 * text in order. We walk that stream, consuming one aligned word per
 * whitespace-separated token of each line; a line's window spans its first
 * word's start to its last word's end.
 */
export function groupWordsIntoLines(
  plainText: string,
  words: AlignedWord[],
): TimedLine[] {
  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const timed: TimedLine[] = [];
  let cursor = 0;

  for (const line of lines) {
    const tokenCount = line.split(/\s+/).filter(Boolean).length;
    if (tokenCount === 0) continue;
    if (cursor >= words.length) break;

    const take = Math.min(tokenCount, words.length - cursor);
    const first = words[cursor];
    const last = words[cursor + take - 1];
    cursor += take;

    timed.push({
      startMs: Math.max(0, Math.round(first.startSeconds * 1000)),
      endMs: Math.max(0, Math.round(last.endSeconds * 1000)),
      text: line,
    });
  }

  return timed;
}
