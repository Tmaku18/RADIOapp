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
  constructor(private configService: ConfigService) {}

  /**
   * Internal method to handle file uploads to Supabase Storage.
   * Consolidates validation and upload logic for all file types.
   * 
   * WARNING: Files are buffered in RAM via Multer. With maxSize of 50MB,
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
        .map(t => t.split('/')[1].toUpperCase())
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
      throw new Error(`Failed to upload ${options.errorPrefix.toLowerCase()}: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(options.bucket)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Upload an audio file (song) to storage.
   * Accepts MP3 and WAV files up to 50MB.
   */
  async uploadAudioFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'songs',
      allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'],
      maxSizeBytes: 50 * 1024 * 1024, // 50MB
      errorPrefix: 'Audio file',
    });
  }

  /**
   * Upload artwork/cover image to storage.
   * Accepts JPEG, PNG, and WebP files up to 5MB.
   */
  async uploadArtworkFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'artwork',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      errorPrefix: 'Artwork file',
      pathPrefix: 'artwork',
    });
  }

  /**
   * Upload a profile/avatar image to storage.
   * Accepts JPEG, PNG, and WebP files up to 2MB.
   */
  async uploadProfileImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    return this._uploadFile(file, userId, {
      bucket: 'avatars',
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxSizeBytes: 2 * 1024 * 1024, // 2MB
      errorPrefix: 'Profile image',
      pathPrefix: 'profiles',
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
    bucket: 'songs' | 'artwork',
    filename: string,
    contentType: string,
  ): Promise<SignedUploadUrlResponse> {
    // Validate content type based on bucket
    const allowedTypes: Record<string, string[]> = {
      songs: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'],
      artwork: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
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
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      throw new BadRequestException(`Failed to generate upload URL: ${error.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      path: data.path,
      expiresIn: 60,
    };
  }
}
