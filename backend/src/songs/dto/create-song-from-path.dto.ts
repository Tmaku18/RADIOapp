import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSongFromPathDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  artistName: string;

  @IsString()
  @IsNotEmpty()
  audioPath: string;

  @IsString()
  @IsOptional()
  artworkPath?: string;
}
