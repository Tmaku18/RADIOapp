import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AlignedWord,
  LyricsAlignmentProvider,
  LyricsAlignmentResult,
} from './lyrics-alignment.provider';

interface ElevenLabsWord {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
}

/**
 * ElevenLabs Forced Alignment provider.
 *
 * POST /v1/forced-alignment with the audio file + the exact lyrics text
 * returns word-level timings (seconds) aligned to that text — no speech
 * recognition guessing, so the output words match the artist's lyrics.
 *
 * Required env:
 *   ELEVENLABS_API_KEY
 */
@Injectable()
export class ElevenLabsAlignmentProvider implements LyricsAlignmentProvider {
  readonly name = 'elevenlabs';
  private readonly logger = new Logger(ElevenLabsAlignmentProvider.name);
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.elevenlabs.io/v1/forced-alignment';
  // Whole songs are a few MB; alignment can take a while for long tracks.
  private readonly timeoutMs = 180_000;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = (
      this.configService.get<string>('ELEVENLABS_API_KEY') || ''
    ).trim();
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async align(audio: Buffer, text: string): Promise<LyricsAlignmentResult> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs alignment provider is not configured');
    }

    const form = new FormData();
    form.append(
      'file',
      // Fresh Uint8Array so the underlying buffer is a plain ArrayBuffer.
      new Blob([new Uint8Array(audio)], { type: 'application/octet-stream' }),
      'audio',
    );
    form.append('text', text);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let json: unknown;
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey },
        body: form,
        signal: controller.signal,
      });
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(
          `ElevenLabs forced-alignment failed (${res.status}): ${bodyText.slice(0, 300)}`,
        );
      }
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error(
          `ElevenLabs returned non-JSON response: ${bodyText.slice(0, 200)}`,
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    const words = this.parseWords(json);
    if (!words.length) {
      throw new Error('ElevenLabs returned no aligned words');
    }
    return { words, provider: this.name };
  }

  private parseWords(json: unknown): AlignedWord[] {
    const raw = (json as { words?: ElevenLabsWord[] })?.words;
    if (!Array.isArray(raw)) return [];
    const words: AlignedWord[] = [];
    for (const entry of raw) {
      const wordText = (entry.text ?? entry.word ?? '').trim();
      if (!wordText) continue; // whitespace/punctuation-only tokens
      const start = typeof entry.start === 'number' ? entry.start : null;
      const end = typeof entry.end === 'number' ? entry.end : null;
      if (start == null || end == null) continue;
      words.push({ word: wordText, startSeconds: start, endSeconds: end });
    }
    return words;
  }
}
