import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { STATION_IDS } from '../../radio/station.constants';

export class UpdateSongDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  artworkUrl?: string;

  @IsString()
  @IsOptional()
  @IsIn([...STATION_IDS])
  stationId?: string;

  @IsBoolean()
  @IsOptional()
  optInFreePlay?: boolean;

  @IsBoolean()
  @IsOptional()
  discoverEnabled?: boolean;

  @IsString()
  @IsOptional()
  discoverClipUrl?: string;

  @IsString()
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  featuredArtistIds?: string[];
}
