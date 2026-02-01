'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function UploadPage() {
  const router = useRouter();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('audio')) {
        setError('Please select a valid audio file (MP3, WAV, M4A, AAC, OGG, FLAC, or WebM)');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError('Audio file must be less than 50MB');
        return;
      }
      setAudioFile(file);
      setError(null);
    }
  };

  const handleArtworkSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('image')) {
        setError('Please select a valid image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Artwork must be less than 5MB');
        return;
      }
      setArtworkFile(file);
      setArtworkPreview(URL.createObjectURL(file));
      setError(null);
    }
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
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    return path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audioFile || !title || !artistName) {
      setError('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      // Upload audio file
      setUploadProgress(20);
      const audioPath = await uploadToSignedUrl(audioFile, 'songs');
      setUploadProgress(50);

      // Upload artwork if provided
      let artworkPath: string | undefined;
      if (artworkFile) {
        artworkPath = await uploadToSignedUrl(artworkFile, 'artwork');
        setUploadProgress(70);
      }

      // Create song record
      setUploadProgress(80);
      await songsApi.create({
        title,
        artistName,
        audioPath,
        artworkPath,
      });

      setUploadProgress(100);

      // Redirect to dashboard with success message
      router.push('/dashboard?upload=success');
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold text-foreground">Upload Music</h2>
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
                className="w-full h-auto py-8 border-dashed flex flex-col"
                onClick={() => audioInputRef.current?.click()}
              >
              {audioFile ? (
                <div>
                  <span className="text-4xl mb-2 block">🎵</span>
                  <p className="text-gray-900 font-medium">{audioFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-4xl mb-2 block">📤</span>
                  <p className="text-gray-600">Click to select audio file</p>
                  <p className="text-sm text-gray-400 mt-1">MP3, WAV, M4A, AAC, OGG, FLAC, WebM — max 50MB</p>
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
                    <p className="text-gray-900 font-medium">{artworkFile?.name}</p>
                    <p className="text-sm text-gray-500">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-2xl">🖼️</span>
                  <span className="text-gray-600">Add album artwork</span>
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

            <Button type="submit" disabled={isUploading || !audioFile} className="w-full">
              {isUploading ? 'Uploading...' : 'Submit for Review'}
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
