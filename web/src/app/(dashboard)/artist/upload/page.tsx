'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';
import { ClipWindowEditor } from '@/components/songs/ClipWindowEditor';
import { TOWERS } from '@/data/station-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

type ApiError = { response?: { data?: { message?: string } } };

const US_STATE_OPTIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

function parseTimeToSeconds(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.includes(':')) {
    const parts = raw.split(':').map((part) => part.trim());
    if (
      parts.length < 2 ||
      parts.length > 3 ||
      parts.some((part) => part.length === 0)
    ) {
      return null;
    }
    let total = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      const parsed = i === parts.length - 1 ? Number(part) : Number.parseInt(part, 10);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      total = total * 60 + parsed;
    }
    return total;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatSecondsForTrimInput(seconds?: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  // Preserve half-second precision (0.5s nudges) in the trim inputs.
  const r = Math.round(seconds * 2) / 2;
  const mins = Math.floor(r / 60);
  const rem = r - mins * 60;
  const whole = Math.floor(rem);
  const ss = whole.toString().padStart(2, '0');
  return rem - whole >= 0.5 ? `${mins}:${ss}.5` : `${mins}:${ss}`;
}

function errorMessage(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object'
      ? (err as ApiError).response?.data?.message
      : undefined;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function UploadPage() {
  const router = useRouter();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const discoverBackgroundInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [discoverBackgroundFile, setDiscoverBackgroundFile] = useState<File | null>(null);
  const [discoverBackgroundPreview, setDiscoverBackgroundPreview] = useState<string | null>(null);
  const [discoverClipStartSeconds, setDiscoverClipStartSeconds] = useState('0:00');
  const [discoverClipEndSeconds, setDiscoverClipEndSeconds] = useState('0:15');
  const [sampleStartSeconds, setSampleStartSeconds] = useState('0:00');
  const [sampleEndSeconds, setSampleEndSeconds] = useState('0:30');
  // Object URL of the main track, used to preview/scrub the sample window.
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  // Local object URL for previewing the discover-clip window, taken from the
  // main track (the discover clip is a window of the song, not a separate file).
  const [discoverPreviewUrl, setDiscoverPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [artistOriginCity, setArtistOriginCity] = useState('');
  const [artistOriginState, setArtistOriginState] = useState('');
  const [stationId, setStationId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readyForRotation, setReadyForRotation] = useState(false);
  const [isExplicit, setIsExplicit] = useState(true);

  useEffect(() => {
    if (!audioFile) {
      setDiscoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setDiscoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  // The sample preview is always taken from the main track, since the sample
  // is the listener-facing 30s preview of the actual song.
  useEffect(() => {
    if (!audioFile) {
      setAudioPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  const extractDurationSeconds = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        audio.preload = 'metadata';

        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onLoaded);
          audio.removeEventListener('error', onError);
          URL.revokeObjectURL(url);
          audio.src = '';
        };

        const onLoaded = () => {
          const seconds = Math.ceil(audio.duration || 0);
          cleanup();
          resolve(seconds > 0 ? seconds : null);
        };

        const onError = () => {
          cleanup();
          resolve(null);
        };

        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('error', onError);
        audio.src = url;
      } catch {
        resolve(null);
      }
    });
  };

  const deriveTitleFromFilename = (name: string): string => {
    return name
      .replace(/\.[^.]+$/, '')
      .replace(/[_]+/g, ' ')
      .trim();
  };

  // Best-effort: read embedded tags (ID3 / MP4 / FLAC / Vorbis) to pre-fill the
  // title, artist, and artwork so artists don't retype what's already in the
  // file. Only fills fields the user hasn't already set; never blocks upload.
  const applyAudioMetadata = async (file: File) => {
    let resolvedTitle = '';
    let resolvedArtist = '';
    try {
      const { parseBlob } = await import('music-metadata');
      const { common } = await parseBlob(file, { duration: false });
      resolvedTitle = common.title?.trim() ?? '';
      resolvedArtist = (common.artist ?? common.albumartist)?.trim() ?? '';

      const picture = common.picture?.[0];
      if (picture && !artworkFile) {
        const type = picture.format || 'image/jpeg';
        const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        const picFile = new File([new Uint8Array(picture.data)], `cover.${ext}`, {
          type,
        });
        if (picFile.size > 0 && picFile.size <= 15 * 1024 * 1024) {
          setArtworkFile(picFile);
          setArtworkPreview(URL.createObjectURL(picFile));
        }
      }
    } catch {
      // Metadata is optional; fall back to the filename for the title.
    }

    if (!resolvedTitle) resolvedTitle = deriveTitleFromFilename(file.name);
    if (resolvedTitle) {
      setTitle((prev) => (prev.trim() ? prev : resolvedTitle));
    }
    if (resolvedArtist) {
      setArtistName((prev) => (prev.trim() ? prev : resolvedArtist));
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('audio')) {
        setError('Please select a valid audio file (MP3, WAV, M4A, AAC, OGG, FLAC, or WebM)');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('Audio file must be less than 100MB');
        return;
      }
      setAudioFile(file);
      setError(null);

      // Best-effort: extract duration in browser so backend doesn't fall back to 180s.
      setDurationSeconds(null);
      void extractDurationSeconds(file).then((secs) => {
        setDurationSeconds(secs);
      });

      // Best-effort: pre-fill title / artist / artwork from the file's metadata.
      void applyAudioMetadata(file);
    }
  };

  const handleArtworkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('image')) {
        setError('Please select a valid image file');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError('Artwork must be less than 15MB');
        return;
      }
      setArtworkFile(file);
      setArtworkPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleDiscoverBackgroundSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('image')) {
      setError('Please select a valid discover background image');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Discover background image must be less than 15MB');
      return;
    }
    setDiscoverBackgroundFile(file);
    setDiscoverBackgroundPreview(URL.createObjectURL(file));
    setError(null);
  };

  const uploadToSignedUrl = async (
    file: File,
    bucket: 'songs' | 'artwork'
  ): Promise<string> => {
    // Get signed URL from backend
    const response = await songsApi.getUploadUrl({
      filename: file.name,
      contentType: file.type,
      bucket,
    });
    
    const { signedUrl, path } = response.data;

    // Upload directly to Supabase
    const controller = new AbortController();
    const timeoutMs = 120000; // 2 minutes to avoid hanging forever at 20%
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error('Upload timed out. Please try again.');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!uploadResponse.ok) {
      let details = '';
      try {
        details = await uploadResponse.text();
      } catch {
        details = '';
      }
      throw new Error(
        `Failed to upload ${bucket} file (${uploadResponse.status}). ${details || 'Please try again.'}`,
      );
    }

    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (
      !audioFile ||
      !title ||
      !artistName ||
      !artistOriginCity.trim() ||
      !artistOriginState.trim()
    ) {
      setError('Please fill in all required fields');
      return;
    }
    if (!stationId) {
      setError('Please select a station/category');
      return;
    }
    {
      // The Discover clip is required for every track (it powers the Discover
      // feed). It's a window set on the main track, so the window must always
      // be valid.
      const start = parseTimeToSeconds(discoverClipStartSeconds);
      const end = parseTimeToSeconds(discoverClipEndSeconds);
      if (start == null || end == null || end <= start) {
        setError(
          'Discover clip window must be valid (mm:ss or seconds) and end must be greater than start',
        );
        return;
      }
      const length = end - start;
      if (length < 5 || length > 15) {
        setError('Discover clip window must be between 5 and 15 seconds');
        return;
      }
    }
    {
      const start = parseTimeToSeconds(sampleStartSeconds);
      const end = parseTimeToSeconds(sampleEndSeconds);
      if (start == null || end == null || end <= start) {
        setError(
          'Sample clip window must be valid (mm:ss or seconds) and end must be greater than start',
        );
        return;
      }
      const length = end - start;
      if (length < 5 || length > 30) {
        setError('Sample clip window must be between 5 and 30 seconds');
        return;
      }
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      // Upload audio file
      setUploadProgress(20);
      let audioPath: string;
      try {
        audioPath = await uploadToSignedUrl(audioFile, 'songs');
      } catch (uploadErr) {
        throw new Error(
          `Audio storage upload failed: ${errorMessage(
            uploadErr,
            'Could not upload audio file.',
          )}`,
        );
      }
      setUploadProgress(50);

      // Upload artwork if provided
      let artworkPath: string | undefined;
      if (artworkFile) {
        try {
          artworkPath = await uploadToSignedUrl(artworkFile, 'artwork');
        } catch (uploadErr) {
          throw new Error(
            `Artwork storage upload failed: ${errorMessage(
              uploadErr,
              'Could not upload artwork file.',
            )}`,
          );
        }
        setUploadProgress(70);
      }

      let discoverBackgroundPath: string | undefined;
      if (discoverBackgroundFile) {
        try {
          discoverBackgroundPath = await uploadToSignedUrl(discoverBackgroundFile, 'artwork');
        } catch (uploadErr) {
          throw new Error(
            `Discover background upload failed: ${errorMessage(
              uploadErr,
              'Could not upload discover background image.',
            )}`,
          );
        }
        setUploadProgress(85);
      }

      // Create song record
      setUploadProgress(90);
      const parsedStartSeconds = parseTimeToSeconds(discoverClipStartSeconds);
      const parsedEndSeconds = parseTimeToSeconds(discoverClipEndSeconds);
      // The listener-facing sample preview is rendered server-side from this
      // window of the main track, so we pass it through create.
      const parsedSampleStart = parseTimeToSeconds(sampleStartSeconds);
      const parsedSampleEnd = parseTimeToSeconds(sampleEndSeconds);
      try {
        await songsApi.create({
          title,
          artistName,
          artistOriginCity: artistOriginCity.trim(),
          artistOriginState: artistOriginState.trim(),
          stationId,
          audioPath,
          artworkPath,
          durationSeconds: durationSeconds ?? undefined,
          discoverBackgroundPath,
          discoverClipStartSeconds: parsedStartSeconds ?? undefined,
          discoverClipEndSeconds: parsedEndSeconds ?? undefined,
          sampleStartSeconds: parsedSampleStart ?? undefined,
          sampleEndSeconds: parsedSampleEnd ?? undefined,
          isExplicit,
        });
      } catch (dbErr) {
        throw new Error(
          `Database save failed after upload: ${errorMessage(
            dbErr,
            'Audio uploaded but song record could not be saved.',
          )}`,
        );
      }

      setUploadProgress(100);
      setReadyForRotation(true);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(errorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  if (readyForRotation) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="glass-panel border-border/80">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-4xl mb-4">✓</div>
            <h2 className="heading-serif text-2xl font-semibold text-foreground">Ready for Rotation</h2>
            <p className="text-muted-foreground mt-2">Your track is in the queue. We&apos;ll review it and add it to the rotation soon.</p>
            {artworkPreview && (
              <div className="mt-6 flex justify-center">
                <img src={artworkPreview} alt="" className="w-32 h-32 rounded-lg object-cover border border-border" />
              </div>
            )}
            <p className="mt-4 font-medium text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{artistName}</p>
            <p className="text-xs text-muted-foreground">
              Content rating: {isExplicit ? 'Explicit' : 'Clean'}
            </p>
            <p className="text-sm text-muted-foreground">
              {artistOriginCity.trim()}, {artistOriginState.trim()}
            </p>
            <Button className="mt-6" onClick={() => router.push('/dashboard')}>
              Back to Studio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <h2 className="heading-serif text-xl font-semibold text-foreground">Upload Song</h2>
          <p className="text-muted-foreground mt-1">Submit your track for review and radio rotation</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Audio File <span className="text-destructive">*</span></Label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac,audio/webm"
                onChange={handleAudioSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="upload-zone-artist w-full h-auto py-8 flex flex-col rounded-lg"
                onClick={() => audioInputRef.current?.click()}
              >
              {audioFile ? (
                <div>
                  <span className="text-4xl mb-2 block">🎵</span>
                  <p className="text-foreground font-medium">{audioFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-4xl mb-2 block">📤</span>
                  <p className="text-foreground">Click to select audio file</p>
                  <p className="text-sm text-muted-foreground mt-1">MP3, WAV, M4A, AAC, OGG, FLAC, WebM — max 100MB</p>
                </div>
              )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Artwork (Optional)</Label>
              <input
                ref={artworkInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleArtworkSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 border-dashed flex flex-col sm:flex-row"
                onClick={() => artworkInputRef.current?.click()}
              >
              {artworkPreview ? (
                <div className="flex items-center space-x-4">
                  <img
                    src={artworkPreview}
                    alt="Artwork preview"
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                  <div className="text-left">
                    <p className="text-foreground font-medium">{artworkFile?.name}</p>
                    <p className="text-sm text-muted-foreground">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-muted-foreground">Add album artwork</span>
                </div>
              )}
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <Label>Sample Clip (Preview)</Label>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">What it is:</span>{' '}
                the free 5–30 second preview of this exact song. It plays on your
                artist profile and anywhere fans can buy the track.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters:</span>{' '}
                it lets listeners try before they buy — a strong sample drives
                more purchases. Pick the most memorable part (the hook or a big
                moment). We render the preview from your main track, so listeners
                never get the full song for free.
              </p>
              <ClipWindowEditor
                audioUrl={audioPreviewUrl}
                durationSeconds={durationSeconds}
                minLength={5}
                maxLength={30}
                startSeconds={parseTimeToSeconds(sampleStartSeconds) ?? 0}
                endSeconds={parseTimeToSeconds(sampleEndSeconds) ?? 30}
                onChange={(start, end) => {
                  setSampleStartSeconds(formatSecondsForTrimInput(start));
                  setSampleEndSeconds(formatSecondsForTrimInput(end));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Defaults to the first 30 seconds. Set the 5–30s preview window
                from your main track above to scrub and preview it.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <Label>Discover Clip (Required)</Label>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">What it is:</span>{' '}
                a short looping clip (5–15s) shown in the Discover feed where
                listeners swipe through new music.
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Why it matters:</span>{' '}
                it&apos;s your first impression in Discover — a punchy loop earns
                the follow, the like, and the full listen. Every track needs one:
                set the 5–15s window from your main track below.
              </p>
              <ClipWindowEditor
                audioUrl={discoverPreviewUrl}
                durationSeconds={durationSeconds}
                minLength={5}
                maxLength={15}
                startSeconds={parseTimeToSeconds(discoverClipStartSeconds) ?? 0}
                endSeconds={parseTimeToSeconds(discoverClipEndSeconds) ?? 15}
                onChange={(start, end) => {
                  setDiscoverClipStartSeconds(formatSecondsForTrimInput(start));
                  setDiscoverClipEndSeconds(formatSecondsForTrimInput(end));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Set the discover window (5–15s) from your main track and preview
                the looping clip.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <Label>Discover Background Image (Optional)</Label>
              <input
                ref={discoverBackgroundInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleDiscoverBackgroundSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 border-dashed flex flex-col sm:flex-row"
                onClick={() => discoverBackgroundInputRef.current?.click()}
              >
                {discoverBackgroundPreview ? (
                  <div className="flex items-center space-x-4">
                    <img
                      src={discoverBackgroundPreview}
                      alt="Discover background preview"
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div className="text-left">
                      <p className="text-foreground font-medium">{discoverBackgroundFile?.name}</p>
                      <p className="text-sm text-muted-foreground">Click to change</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🌄</span>
                    <span className="text-muted-foreground">Upload discover background image</span>
                  </div>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Song Title <span className="text-destructive">*</span></Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter song title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artistName">Artist Name <span className="text-destructive">*</span></Label>
              <Input id="artistName" required value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Enter artist name" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="artistOriginCity">City <span className="text-destructive">*</span></Label>
                <Input
                  id="artistOriginCity"
                  required
                  value={artistOriginCity}
                  onChange={(e) => setArtistOriginCity(e.target.value)}
                  placeholder="e.g. Atlanta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="artistOriginState">State <span className="text-destructive">*</span></Label>
                <select
                  id="artistOriginState"
                  required
                  value={artistOriginState}
                  onChange={(e) => setArtistOriginState(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select state</option>
                  {US_STATE_OPTIONS.map((stateCode) => (
                    <option key={stateCode} value={stateCode}>
                      {stateCode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stationId">Station / Category <span className="text-destructive">*</span></Label>
              <select
                id="stationId"
                required
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a station</option>
                {TOWERS.map((tower) => (
                  <option key={tower.id} value={tower.id}>
                    {tower.genre} (National)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="isExplicit">Mark as explicit</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Songs are marked explicit by default. Uncheck only if this
                    track has no explicit language/content.
                  </p>
                </div>
                <input
                  id="isExplicit"
                  type="checkbox"
                  checked={isExplicit}
                  onChange={(e) => setIsExplicit(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </div>

            {isUploading && (
              <div>
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <Button type="submit" disabled={isUploading || !audioFile || !stationId} className="w-full">
              {isUploading ? 'Uploading...' : 'Submit for Rotation'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Your track will be reviewed by our team within 24-48 hours.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
