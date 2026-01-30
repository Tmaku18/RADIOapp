import { IsString, IsIn } from 'class-validator';

export class GetUploadUrlDto {
  @IsString()
  filename: string;

  @IsString()
  @IsIn([
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'image/jpeg',
    'image/png',
    'image/webp',
  ])
  contentType: string;

  @IsString()
  @IsIn(['songs', 'artwork'])
  bucket: 'songs' | 'artwork';
}
