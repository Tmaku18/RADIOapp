import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
  IsBoolean,
  IsArray,
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
  artistOriginCity: string;

  @IsString()
  @IsNotEmpty()
  artistOriginState: string;

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stationIds?: string[];

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

  /** Start of the listener-facing sample preview window (seconds). */
  @IsNumber()
  @IsOptional()
  @Min(0)
  sampleStartSeconds?: number;

  /** End of the listener-facing sample preview window (seconds; 5–30s span). */
  @IsNumber()
  @IsOptional()
  @Min(0)
  sampleEndSeconds?: number;

  @IsBoolean()
  @IsOptional()
  isExplicit?: boolean;

  /**
   * Optional lyrics text. When provided, the backend force-aligns it to the
   * audio in the background to produce synced captions (timed_lines).
   */
  @IsString()
  @IsOptional()
  lyricsPlainText?: string;

  /** Required to submit for NETWORX Radio rotation. */
  @IsBoolean()
  @IsOptional()
  optInFullSongRadio?: boolean;

  @IsBoolean()
  @IsOptional()
  optInDjLivestreams?: boolean;

  @IsBoolean()
  @IsOptional()
  optInDjArchivedMixes?: boolean;
}
