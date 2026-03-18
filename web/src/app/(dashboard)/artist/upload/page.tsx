'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';
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
  const discoverClipInputRef = useRef<HTMLInputElement>(null);
  const discoverBackgroundInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [discoverClipFile, setDiscoverClipFile] = useState<File | null>(null);
  const [discoverBackgroundFile, setDiscoverBackgroundFile] = useState<File | null>(null);
  const [discoverBackgroundPreview, setDiscoverBackgroundPreview] = useState<string | null>(null);
  const [discoverClipStartSeconds, setDiscoverClipStartSeconds] = useState('0:00');
  const [discoverClipEndSeconds, setDiscoverClipEndSeconds] = useState('0:15');
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [artistOriginCity, setArtistOriginCity] = useState('');
  const [artistOriginState, setArtistOriginState] = useState('');
  const [stationId, setStationId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [readyForRotation, setReadyForRotation] = useState(false);

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

  const handleDiscoverClipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('audio')) {
      setError('Please select a valid discover clip audio file');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Discover clip must be less than 20MB');
      return;
    }
    setDiscoverClipFile(file);
    setError(null);
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
    if (discoverClipFile) {
      const start = parseTimeToSeconds(discoverClipStartSeconds);
      const end = parseTimeToSeconds(discoverClipEndSeconds);
      if (start == null || end == null || end <= start) {
        setError(
          'Discover clip trim must be valid (mm:ss or seconds) and end must be greater than start',
        );
        return;
      }
      if (end - start > 15) {
        setError('Discover clip trim range must be 15 seconds or less');
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

      let discoverClipPath: string | undefined;
      if (discoverClipFile) {
        try {
          discoverClipPath = await uploadToSignedUrl(discoverClipFile, 'songs');
        } catch (uploadErr) {
          throw new Error(
            `Discover clip upload failed: ${errorMessage(
              uploadErr,
              'Could not upload discover clip.',
            )}`,
          );
        }
        setUploadProgress(80);
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
          discoverClipPath,
          discoverBackgroundPath,
          discoverClipStartSeconds: parsedStartSeconds ?? undefined,
          discoverClipEndSeconds: parsedEndSeconds ?? undefined,
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
              <Label>Discover Clip Audio (Optional)</Label>
              <input
                ref={discoverClipInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac,audio/webm"
                onChange={handleDiscoverClipSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 border-dashed flex flex-col sm:flex-row"
                onClick={() => discoverClipInputRef.current?.click()}
              >
                {discoverClipFile ? (
                  <div className="text-left">
                    <p className="text-foreground font-medium">{discoverClipFile.name}</p>
                    <p className="text-sm text-muted-foreground">Discover clip selected</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-2xl">🎚️</span>
                    <span className="text-muted-foreground">Upload discover clip (max 15s after trim)</span>
                  </div>
                )}
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="discover-start">Clip Start (mm:ss or seconds)</Label>
                  <Input
                    id="discover-start"
                    type="text"
                    inputMode="decimal"
                    placeholder="0:00"
                    value={discoverClipStartSeconds}
                    onChange={(e) => setDiscoverClipStartSeconds(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="discover-end">Clip End (mm:ss or seconds)</Label>
                  <Input
                    id="discover-end"
                    type="text"
                    inputMode="decimal"
                    placeholder="0:15"
                    value={discoverClipEndSeconds}
                    onChange={(e) => setDiscoverClipEndSeconds(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Artists can trim discover playback to 15 seconds max. If no
                discover clip is uploaded, trim is generated from your main
                audio. Examples: `0:12`, `1:05`, or `12.5`.
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
