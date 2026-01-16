import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabaseClient } from '../config/supabase.config';
import * as crypto from 'crypto';

@Injectable()
export class UploadsService {
  constructor(private configService: ConfigService) {}

  async uploadAudioFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    // Validate file type
    const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid audio file type. Only MP3 and WAV are allowed');
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    const supabase = getSupabaseClient();
    const fileName = `${userId}/${crypto.randomUUID()}.${file.originalname.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('songs')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('songs')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  async uploadArtworkFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Artwork file is required');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image file type. Only JPEG, PNG, and WebP are allowed');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('Image size exceeds 5MB limit');
    }

    const supabase = getSupabaseClient();
    const fileName = `${userId}/artwork/${crypto.randomUUID()}.${file.originalname.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('artwork')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload artwork: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('artwork')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }
}
