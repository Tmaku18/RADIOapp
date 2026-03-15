import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { STATION_IDS } from '../../radio/station.constants';

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

  /**
   * Duration in seconds - should be provided by client for direct uploads.
   * NOTE: For security, this should be verified via background job.
   * The multipart upload endpoint validates duration server-side.
   */
  @IsNumber()
  @IsOptional()
  @Min(1)
  durationSeconds?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn([...STATION_IDS])
  stationId: string;

  @IsString()
  @IsOptional()
  discoverClipPath?: string;

  @IsString()
  @IsOptional()
  discoverBackgroundPath?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discoverClipStartSeconds?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discoverClipEndSeconds?: number;
}
