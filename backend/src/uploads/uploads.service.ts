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
  private readonly feedUploadAllowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];
  private readonly portfolioBucketTargetBytes = 25 * 1024 * 1024;
  private readonly portfolioAllowedMimeTypes = [
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
    'video/mp4',
    'video/webm',
  ];
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
  private readonly lastImageBucketEnsureAt = new Map<string, number>();

  constructor(private configService: ConfigService) {}

  private isBucketNotFoundError(error: unknown, bucket: string): boolean {
    const maybe = error as { message?: string; code?: string } | null;
    const msg = (maybe?.message ?? '').toLowerCase();
    return (
      msg.includes('bucket not found') ||
      msg.includes(`bucket ${bucket.toLowerCase()} not found`) ||
      msg.includes(`'${bucket.toLowerCase()}' not found`)
    );
  }

  private getBucketDefaults(bucket: string): {
    public: boolean;
    fileSizeLimit: number;
    allowedMimeTypes: string[];
  } | null {
    if (bucket === 'songs') {
      return {
        public: true,
        fileSizeLimit: this.songBucketTargetBytes,
        allowedMimeTypes: this.songBucketAllowedMimeTypes,
      };
    }
    if (bucket === 'artwork' || bucket === 'avatars' || bucket === 'feed') {
      const requiredMimeTypes =
        bucket === 'feed'
          ? this.feedUploadAllowedMimeTypes
          : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      return {
        public: true,
        fileSizeLimit: this.imageUploadMaxBytes,
        allowedMimeTypes: requiredMimeTypes,
      };
    }
    if (bucket === 'portfolio') {
      return {
        public: true,
        fileSizeLimit: this.portfolioBucketTargetBytes,
        allowedMimeTypes: this.portfolioAllowedMimeTypes,
      };
    }
    return null;
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    const defaults = this.getBucketDefaults(bucket);
    if (!defaults) return;
    const supabase = getSupabaseClient();
    const { data: existing, error: getError } =
      await supabase.storage.getBucket(bucket);
    if (!getError && existing) return;

    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: defaults.public,
      fileSizeLimit: defaults.fileSizeLimit,
      allowedMimeTypes: defaults.allowedMimeTypes,
    });
    if (createError) {
      const conflict = (createError.message || '')
        .toLowerCase()
        .includes('already exists');
      if (!conflict) {
        throw new BadRequestException(
          `Storage bucket "${bucket}" is missing and could not be created automatically: ${createError.message}`,
        );
      }
    }
  }

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

  private async ensureImageBucketLimit(bucketName: string): Promise<void> {
    const now = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;
    const lastEnsureAt = this.lastImageBucketEnsureAt.get(bucketName) ?? 0;
    if (now - lastEnsureAt < tenMinutesMs) return;

    const supabase = getSupabaseClient();
    const { data: bucket, error: getError } =
      await supabase.storage.getBucket(bucketName);
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

    const requiredMimeTypes =
      bucketName === 'feed'
        ? this.feedUploadAllowedMimeTypes
        : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const currentMimeTypes = Array.isArray((bucket as any).allowed_mime_types)
      ? (bucket as any).allowed_mime_types
      : Array.isArray((bucket as any).allowedMimeTypes)
        ? (bucket as any).allowedMimeTypes
        : [];
    const missingRequiredMimeType = requiredMimeTypes.some(
      (mime) => !currentMimeTypes.includes(mime),
    );

    if (
      currentLimit !== null &&
      currentLimit >= this.imageUploadMaxBytes &&
      !missingRequiredMimeType
    ) {
      this.lastImageBucketEnsureAt.set(bucketName, now);
      return;
    }

    const nextMimeTypes = missingRequiredMimeType
      ? [...new Set([...currentMimeTypes, ...requiredMimeTypes])]
      : currentMimeTypes;

    await supabase.storage.updateBucket(bucketName, {
      public: Boolean((bucket as any).public),
      fileSizeLimit: this.imageUploadMaxBytes,
      allowedMimeTypes:
        nextMimeTypes.length > 0 ? nextMimeTypes : requiredMimeTypes,
    });
    this.lastImageBucketEnsureAt.set(bucketName, now);
  }

  private async ensurePortfolioBucketLimit(): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: bucket, error: getError } =
      await supabase.storage.getBucket('portfolio');
    if (getError || !bucket) return;

    const currentLimit =
      typeof (bucket as any).file_size_limit === 'number'
        ? (bucket as any).file_size_limit
        : typeof (bucket as any).fileSizeLimit === 'number'
          ? (bucket as any).fileSizeLimit
          : null;
    const currentMimeTypes = Array.isArray((bucket as any).allowed_mime_types)
      ? (bucket as any).allowed_mime_types
      : Array.isArray((bucket as any).allowedMimeTypes)
        ? (bucket as any).allowedMimeTypes
        : [];
    const missingMime = this.portfolioAllowedMimeTypes.some(
      (mime) => !currentMimeTypes.includes(mime),
    );

    if (
      currentLimit !== null &&
      currentLimit >= this.portfolioBucketTargetBytes &&
      !missingMime
    ) {
      return;
    }

    await supabase.storage.updateBucket('portfolio', {
      public: Boolean((bucket as any).public),
      fileSizeLimit: this.portfolioBucketTargetBytes,
      allowedMimeTypes: [
        ...new Set([...currentMimeTypes, ...this.portfolioAllowedMimeTypes]),
      ],
    });
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

    // Upload to Supabase Storage. If avatars bucket is unavailable in a given
    // environment, fall back to artwork so profile uploads keep working.
    const bucketCandidates =
      options.bucket === 'avatars' ? ['avatars', 'artwork'] : [options.bucket];
    const supabase = getSupabaseClient();
    let lastError: { message?: string } | null = null;

    for (const bucketName of bucketCandidates) {
      if (bucketName === 'songs') {
        await this.ensureSongBucketLimit();
      }
      if (
        bucketName === 'avatars' ||
        bucketName === 'artwork' ||
        bucketName === 'feed'
      ) {
        await this.ensureImageBucketLimit(bucketName);
      }

      const attemptUpload = async () =>
        supabase.storage.from(bucketName).upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      let { data, error } = await attemptUpload();

      if (error && this.isBucketNotFoundError(error, bucketName)) {
        await this.ensureBucketExists(bucketName);
        ({ data, error } = await attemptUpload());
      }

      if (error) {
        lastError = error;
        if (
          this.isBucketNotFoundError(error, bucketName) &&
          bucketName !== bucketCandidates[bucketCandidates.length - 1]
        ) {
          continue;
        }
        throw new BadRequestException(
          `Failed to upload ${options.errorPrefix.toLowerCase()}: ${error.message}`,
        );
      }
      if (!data) {
        throw new BadRequestException(
          `Failed to upload ${options.errorPrefix.toLowerCase()}: Empty storage response`,
        );
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }

    throw new BadRequestException(
      `Failed to upload ${options.errorPrefix.toLowerCase()}: ${lastError?.message ?? 'Unknown storage error'}`,
    );
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
   * Upload a discover feed post media file (catalyst posts in Discover tab).
   * Accepts images (JPEG/PNG/WebP) and short videos (MP4/WEBM/MOV) up to 15MB.
   */
  async uploadFeedPostMedia(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'feed',
      allowedMimeTypes: this.feedUploadAllowedMimeTypes,
      maxSizeBytes: this.imageUploadMaxBytes, // 15MB
      errorPrefix: 'Feed media',
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
        'video/mp4',
        'video/webm',
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
    if (bucket === 'portfolio') {
      await this.ensurePortfolioBucketLimit();
    }
    const attemptSignedUrl = async () =>
      supabase.storage.from(bucket).createSignedUploadUrl(path);
    let { data, error } = await attemptSignedUrl();

    if (error && this.isBucketNotFoundError(error, bucket)) {
      await this.ensureBucketExists(bucket);
      ({ data, error } = await attemptSignedUrl());
    }

    if (error) {
      throw new BadRequestException(
        `Failed to generate upload URL: ${error.message}`,
      );
    }
    if (!data) {
      throw new BadRequestException(
        'Failed to generate upload URL: Empty storage response',
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
