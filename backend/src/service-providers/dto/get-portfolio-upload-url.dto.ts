import { IsIn, IsString } from 'class-validator';

export class GetPortfolioUploadUrlDto {
  @IsString()
  filename: string;

  @IsString()
  @IsIn([
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
  ])
  contentType: string;
}

