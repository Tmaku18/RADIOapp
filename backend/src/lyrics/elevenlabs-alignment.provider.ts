import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AlignedWord,
  LyricsAlignmentProvider,
  LyricsAlignmentResult,
  LyricsTranscriptionProvider,
  LyricsTranscriptionResult,
} from './lyrics-alignment.provider';

interface ElevenLabsWord {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
  /** STT only: 'word' | 'spacing' | 'audio_event'. */
  type?: string;
}

/**
 * ElevenLabs audio-to-captions provider.
 *
 * - Forced Alignment (POST /v1/forced-alignment): audio + exact lyrics text →
 *   word timings matching the artist's words (no recognition guessing).
 * - Speech-to-Text (POST /v1/speech-to-text, Scribe): audio only → best-effort
 *   transcript with word timings; used as the auto-caption fallback when a
 *   song has no lyrics on file.
 *
 * Required env:
 *   ELEVENLABS_API_KEY
 * Optional env:
 *   ELEVENLABS_STT_MODEL_ID (default scribe_v1)
 */
@Injectable()
export class ElevenLabsAlignmentProvider
  implements LyricsAlignmentProvider, LyricsTranscriptionProvider
{
  readonly name = 'elevenlabs';
  private readonly logger = new Logger(ElevenLabsAlignmentProvider.name);
  private readonly apiKey: string;
  private readonly sttModelId: string;
  private readonly endpoint = 'https://api.elevenlabs.io/v1/forced-alignment';
  private readonly sttEndpoint = 'https://api.elevenlabs.io/v1/speech-to-text';
  // Whole songs are a few MB; alignment can take a while for long tracks.
  private readonly timeoutMs = 180_000;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = (
      this.configService.get<string>('ELEVENLABS_API_KEY') || ''
    ).trim();
    this.sttModelId =
      (this.configService.get<string>('ELEVENLABS_STT_MODEL_ID') || '').trim() ||
      'scribe_v1';
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

  /**
   * Transcribe audio with word timestamps (Scribe). Best-effort — lyrics sung
   * over heavy instrumentals will contain recognition errors, so callers must
   * flag the result as auto-generated.
   */
  async transcribe(audio: Buffer): Promise<LyricsTranscriptionResult> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs transcription provider is not configured');
    }

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: 'application/octet-stream' }),
      'audio',
    );
    form.append('model_id', this.sttModelId);
    // Song captions shouldn't include "(music)" / "(applause)" style events.
    form.append('tag_audio_events', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let json: unknown;
    try {
      const res = await fetch(this.sttEndpoint, {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey },
        body: form,
        signal: controller.signal,
      });
      const bodyText = await res.text();
      if (!res.ok) {
        throw new Error(
          `ElevenLabs speech-to-text failed (${res.status}): ${bodyText.slice(0, 300)}`,
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

    const raw = (json as { words?: ElevenLabsWord[]; text?: string }) ?? {};
    // STT word stream includes 'spacing' and 'audio_event' tokens; keep only
    // real words for caption timing.
    const words: AlignedWord[] = [];
    for (const entry of raw.words ?? []) {
      if (entry.type && entry.type !== 'word') continue;
      const wordText = (entry.text ?? '').trim();
      if (!wordText) continue;
      const start = typeof entry.start === 'number' ? entry.start : null;
      const end = typeof entry.end === 'number' ? entry.end : null;
      if (start == null || end == null) continue;
      words.push({ word: wordText, startSeconds: start, endSeconds: end });
    }

    if (!words.length) {
      throw new Error('ElevenLabs transcription returned no words');
    }
    return {
      words,
      text: (raw.text ?? '').trim(),
      provider: `${this.name}-scribe`,
    };
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
