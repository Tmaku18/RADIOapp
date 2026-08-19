'use client';

import { useRef, useState } from 'react';
import { studiosApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PHOTOS = 12;

export function StudioPhotoUploader({
  heroUrl,
  photos,
  onHeroChange,
  onPhotosChange,
}: {
  heroUrl: string;
  photos: string[];
  onHeroChange: (url: string) => void;
  onPhotosChange: (urls: string[]) => void;
}) {
  const heroRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'hero' | 'gallery' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      throw new Error('Please choose a JPEG, PNG, or WebP image.');
    }
    if (file.size > MAX_BYTES) {
      throw new Error('Image must be 15MB or smaller.');
    }
    const res = await studiosApi.uploadPhoto(file);
    const url = res.data.url?.trim();
    if (!url) throw new Error('Upload failed');
    return url;
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="space-y-2">
        <Label>Banner photo</Label>
        <input
          ref={heroRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy('hero');
            setError(null);
            try {
              onHeroChange(await upload(file));
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed');
            } finally {
              setBusy(null);
            }
          }}
        />
        <button
          type="button"
          onClick={() => heroRef.current?.click()}
          disabled={busy === 'hero'}
          className="relative w-full aspect-[16/7] overflow-hidden rounded-xl border border-border bg-muted/40"
        >
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {busy === 'hero' ? 'Uploading…' : 'Upload banner'}
            </span>
          )}
        </button>
        {heroUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onHeroChange('')}>
            Remove banner
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Studio photos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy === 'gallery' || photos.length >= MAX_PHOTOS}
            onClick={() => galleryRef.current?.click()}
          >
            {busy === 'gallery' ? 'Uploading…' : 'Add photo'}
          </Button>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setBusy('gallery');
            setError(null);
            try {
              const url = await upload(file);
              onPhotosChange([...photos, url]);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Upload failed');
            } finally {
              setBusy(null);
            }
          }}
        />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((src) => (
              <div key={src} className="relative h-24 w-32 overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white"
                  onClick={() => onPhotosChange(photos.filter((p) => p !== src))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
