import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsNumber,
  Min,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { STATION_IDS } from '../../radio/station.constants';

export class CreateSongDto {
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

  @IsString()
  @IsNotEmpty()
  @IsIn([...STATION_IDS])
  stationId: string;

  @IsUrl()
  @IsOptional()
  discoverClipUrl?: string;

  @IsUrl()
  @IsOptional()
  discoverBackgroundUrl?: string;

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
}
