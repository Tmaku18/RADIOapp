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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stationIds?: string[];

  @IsBoolean()
  @IsOptional()
  optInFreePlay?: boolean;

  @IsBoolean()
  @IsOptional()
  optInFullSongRadio?: boolean;

  @IsBoolean()
  @IsOptional()
  optInDjLivestreams?: boolean;

  @IsBoolean()
  @IsOptional()
  optInDjArchivedMixes?: boolean;

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

  @IsBoolean()
  @IsOptional()
  isExplicit?: boolean;

  /** Public songs play on radio rotation; private songs are hidden from radio but can still go to The Refinery. */
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
