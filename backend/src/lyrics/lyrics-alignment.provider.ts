/**
 * Pluggable lyrics forced-alignment provider.
 *
 * Given the full song audio and the artist-supplied lyrics text, a provider
 * returns per-word timings aligned to that exact text. The lyrics service
 * groups those words back into the artist's lines for line-level captions.
 *
 * Mirrors the copyright `AcrCloudProvider` pattern so vendors are swappable
 * (ElevenLabs today; anything that can produce word timings tomorrow).
 */

export interface AlignedWord {
  /** The word as it appears in the supplied lyrics text. */
  word: string;
  /** Start time in seconds from the beginning of the audio. */
  startSeconds: number;
  /** End time in seconds from the beginning of the audio. */
  endSeconds: number;
}

export interface LyricsAlignmentResult {
  words: AlignedWord[];
  provider: string;
}

export interface LyricsAlignmentProvider {
  readonly name: string;
  /** Whether the provider has the credentials it needs to run. */
  isConfigured(): boolean;
  /**
   * Align `text` (the full lyrics) against `audio` (the full song file).
   * Throws on provider errors; the caller marks the row failed.
   */
  align(audio: Buffer, text: string): Promise<LyricsAlignmentResult>;
}

export interface LyricsTranscriptionResult {
  /** Words with timings, in playback order (no artist text to anchor to). */
  words: AlignedWord[];
  /** Full transcript text as returned by the provider. */
  text: string;
  provider: string;
}

/**
 * Optional capability: transcribe audio with no lyrics text (speech-to-text).
 * Used as the auto-caption fallback for songs whose artists never provided
 * lyrics. Output is a best-effort guess and is flagged auto-generated.
 */
export interface LyricsTranscriptionProvider {
  readonly name: string;
  isConfigured(): boolean;
  transcribe(audio: Buffer): Promise<LyricsTranscriptionResult>;
}

/** Injection token for the active alignment provider. */
export const LYRICS_ALIGNMENT_PROVIDER = 'LYRICS_ALIGNMENT_PROVIDER';
