import { IsString, IsNotEmpty, IsOptional, IsUrl, IsNumber, Min } from 'class-validator';

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  artistName: string;

  @IsUrl()
  @IsNotEmpty()
  audioUrl: string;

  @IsUrl()
  @IsOptional()
  artworkUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  durationSeconds?: number;
}
