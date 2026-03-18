import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import * as crypto from 'crypto';

/**
 * Response from signed upload URL generation
 */
export interface SignedUploadUrlResponse {
  signedUrl: string;
  path: string;
  expiresIn: number;
}

/**
 * Configuration options for file upload
 */
interface UploadOptions {
  /** Supabase storage bucket name */
  bucket: string;
  /** Allowed MIME types for this upload */
  allowedMimeTypes: string[];
  /** Maximum file size in bytes */
  maxSizeBytes: number;
  /** Error message prefix for validation errors */
  errorPrefix: string;
  /** Optional path prefix within the bucket */
  pathPrefix?: string;
}

@Injectable()
export class UploadsService {
  private readonly songBucketTargetBytes = 100 * 1024 * 1024;
  private readonly imageUploadMaxBytes = 15 * 1024 * 1024;
  private readonly songBucketAllowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/webm',
  ];
  private lastSongBucketEnsureAt = 0;

  constructor(private configService: ConfigService) {}

  private async ensureSongBucketLimit(): Promise<void> {
    // Avoid calling storage metadata APIs on every single upload request.
    const now = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;
    if (now - this.lastSongBucketEnsureAt < tenMinutesMs) return;

    const supabase = getSupabaseClient();
    const { data: bucket, error: getError } =
      await supabase.storage.getBucket('songs');
    if (getError || !bucket) {
      // Do not block uploads if metadata lookup fails.
      return;
    }

    const currentLimit =
      typeof (bucket as any).file_size_limit === 'number'
        ? (bucket as any).file_size_limit
        : typeof (bucket as any).fileSizeLimit === 'number'
          ? (bucket as any).fileSizeLimit
          : null;

    if (currentLimit !== null && currentLimit >= this.songBucketTargetBytes) {
      this.lastSongBucketEnsureAt = now;
      return;
    }

    const maybeAllowedMimeTypes = Array.isArray(
      (bucket as any).allowed_mime_types,
    )
      ? (bucket as any).allowed_mime_types
      : Array.isArray((bucket as any).allowedMimeTypes)
        ? (bucket as any).allowedMimeTypes
        : this.songBucketAllowedMimeTypes;

    await supabase.storage.updateBucket('songs', {
      public: Boolean((bucket as any).public),
      fileSizeLimit: this.songBucketTargetBytes,
      allowedMimeTypes: maybeAllowedMimeTypes,
    });
    this.lastSongBucketEnsureAt = now;
  }

  /**
   * Internal method to handle file uploads to Supabase Storage.
   * Consolidates validation and upload logic for all file types.
   *
   * WARNING: Files are buffered in RAM via Multer. With maxSize of 100MB,
   * concurrent uploads could cause OOM on low-memory servers.
   * Consider streaming uploads for production at scale.
   */
  private async _uploadFile(
    file: Express.Multer.File,
    userId: string,
    options: UploadOptions,
  ): Promise<string> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException(`${options.errorPrefix} is required`);
    }

    // Validate file type
    if (!options.allowedMimeTypes.includes(file.mimetype)) {
      const allowedTypes = options.allowedMimeTypes
        .map((t) => t.split('/')[1].toUpperCase())
        .join(', ');
      throw new BadRequestException(
        `Invalid ${options.errorPrefix.toLowerCase()} type. Allowed: ${allowedTypes}`,
      );
    }

    // Validate file size
    if (file.size > options.maxSizeBytes) {
      const maxSizeMB = Math.round(options.maxSizeBytes / (1024 * 1024));
      throw new BadRequestException(
        `${options.errorPrefix} size exceeds ${maxSizeMB}MB limit`,
      );
    }

    // Generate unique filename
    const extension = file.originalname.split('.').pop() || 'bin';
    const pathPrefix = options.pathPrefix ? `${options.pathPrefix}/` : '';
    const fileName = `${userId}/${pathPrefix}${crypto.randomUUID()}.${extension}`;

    // Upload to Supabase Storage
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(options.bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new BadRequestException(
        `Failed to upload ${options.errorPrefix.toLowerCase()}: ${error.message}`,
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(options.bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Upload an audio file (song) to storage.
   * Accepts MP3, WAV, M4A, AAC, OGG, FLAC, WebM up to 100MB.
   */
  async uploadAudioFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'songs',
      allowedMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/flac',
        'audio/webm',
      ],
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      errorPrefix: 'Audio file',
    });
  }

  /**
   * Upload artwork/cover image to storage.
   * Accepts JPEG, PNG, and WebP files up to 15MB.
   */
  async uploadArtworkFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'artwork',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: this.imageUploadMaxBytes, // 15MB
      errorPrefix: 'Artwork file',
      pathPrefix: 'artwork',
    });
  }

  /**
   * Upload a profile/avatar image to storage.
   * Accepts JPEG, PNG, and WebP files up to 15MB.
   */
  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'avatars',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: this.imageUploadMaxBytes, // 15MB
      errorPrefix: 'Profile image',
      pathPrefix: 'profiles',
    });
  }

  /**
   * Upload a discover feed post image (catalyst posts in Discover tab).
   * Accepts JPEG, PNG, and WebP files up to 15MB.
   */
  async uploadFeedPostImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'feed',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: this.imageUploadMaxBytes, // 15MB
      errorPrefix: 'Feed image',
      pathPrefix: 'posts',
    });
  }

  /**
   * Upload a cover/background (hero) image for ProNetworx profiles.
   * Accepts JPEG, PNG, and WebP files up to 15MB.
   */
  async uploadHeroImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'avatars',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: this.imageUploadMaxBytes, // 15MB
      errorPrefix: 'Cover image',
      pathPrefix: 'hero',
    });
  }

  /**
   * Generate a signed upload URL for direct client-to-Supabase uploads.
   * This bypasses the server, reducing bandwidth and memory usage.
   *
   * @param userId - The user's database ID
   * @param bucket - Target storage bucket ('songs' or 'artwork')
   * @param filename - Original filename (used for extension)
   * @param contentType - MIME type of the file
   * @returns Signed URL and path for direct upload
   */
  async getSignedUploadUrl(
    userId: string,
    bucket: 'songs' | 'artwork' | 'portfolio',
    filename: string,
    contentType: string,
  ): Promise<SignedUploadUrlResponse> {
    // Validate content type based on bucket
    const allowedTypes: Record<string, string[]> = {
      songs: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/flac',
        'audio/webm',
      ],
      artwork: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      portfolio: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/flac',
        'audio/webm',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ],
    };

    if (!allowedTypes[bucket]?.includes(contentType)) {
      throw new BadRequestException(
        `Invalid content type for ${bucket} bucket. Allowed: ${allowedTypes[bucket].join(', ')}`,
      );
    }

    // Generate unique path
    const extension = filename.split('.').pop() || 'bin';
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    // Generate signed upload URL (60 seconds expiry)
    const supabase = getSupabaseClient();
    if (bucket === 'songs') {
      await this.ensureSongBucketLimit();
    }
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw new BadRequestException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }

    const supabaseUrl = (
      this.configService.get<string>('SUPABASE_URL') || ''
    ).trim();
    const normalizedBase = supabaseUrl.endsWith('/')
      ? supabaseUrl.slice(0, -1)
      : supabaseUrl;
    const normalizedSignedUrl = data.signedUrl.startsWith('http')
      ? data.signedUrl
      : `${normalizedBase}${data.signedUrl.startsWith('/') ? '' : '/'}${data.signedUrl}`;

    return {
      signedUrl: normalizedSignedUrl,
      path: data.path,
      expiresIn: 60,
    };
  }
}
