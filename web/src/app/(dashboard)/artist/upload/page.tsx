'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { songsApi } from '@/lib/api';

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
        setError('Please select a valid audio file (MP3 or WAV)');
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Music</h2>
          <p className="text-gray-600 mt-1">
            Submit your track for review and radio rotation
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Audio File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio File <span className="text-red-500">*</span>
            </label>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp3"
              onChange={handleAudioSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => audioInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors"
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
                  <p className="text-sm text-gray-400 mt-1">MP3 or WAV, max 50MB</p>
                </div>
              )}
            </button>
          </div>

          {/* Artwork */}
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
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition-colors"
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

          {/* Title */}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter song title"
            />
          </div>

          {/* Artist Name */}
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter artist name"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isUploading || !audioFile}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Submit for Review'}
          </button>

          <p className="text-sm text-gray-500 text-center">
            Your track will be reviewed by our team within 24-48 hours.
          </p>
        </form>
      </div>
    </div>
  );
}
