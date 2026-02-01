'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { songsApi, adminApi } from '@/lib/api';

export default function AdminFallbackUploadPage() {
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
    const response = await songsApi.getUploadUrl({
      filename: file.name,
      contentType: file.type,
      bucket,
    });

    const { signedUrl, path } = response.data;

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
      setUploadProgress(20);
      const audioPath = await uploadToSignedUrl(audioFile, 'songs');
      setUploadProgress(50);

      let artworkPath: string | undefined;
      if (artworkFile) {
        artworkPath = await uploadToSignedUrl(artworkFile, 'artwork');
        setUploadProgress(70);
      }

      setUploadProgress(80);
      await adminApi.addFallbackSongFromUpload({
        title,
        artistName,
        audioPath,
        artworkPath,
      });

      setUploadProgress(100);

      router.push('/admin/songs?upload=success');
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link
          href="/admin/fallback"
          className="text-primary hover:text-primary/90 text-sm"
        >
          ← Back to Fallback Playlist
        </Link>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Song for Free Rotation</h2>
          <p className="text-gray-600 mt-1">
            Uploads go to the song database. You must approve and enable free rotation in Admin Songs before the song can play.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio File <span className="text-red-500">*</span>
            </label>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac,audio/webm"
              onChange={handleAudioSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
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
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Artwork (Optional)
            </label>
            <input
              ref={artworkInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleArtworkSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => artworkInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors"
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
            </button>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Song Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter song title"
            />
          </div>

          <div>
            <label htmlFor="artistName" className="block text-sm font-medium text-gray-700 mb-1">
              Artist Name <span className="text-red-500">*</span>
            </label>
            <input
              id="artistName"
              type="text"
              required
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Enter artist name"
            />
          </div>

          {isUploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading || !audioFile}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Add to Song Database'}
          </button>
        </form>
      </div>
    </div>
  );
}
