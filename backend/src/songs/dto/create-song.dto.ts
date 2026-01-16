import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

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
}
