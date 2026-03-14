import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
