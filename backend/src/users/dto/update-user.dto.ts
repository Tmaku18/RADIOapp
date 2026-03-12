import { IsString, IsOptional, IsUrl, IsBoolean, ValidateIf, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  /** Switch account mode between listener, artist, and catalyst (service_provider). */
  @IsIn(['listener', 'artist', 'service_provider'])
  @IsOptional()
  role?: 'listener' | 'artist' | 'service_provider';

  @ValidateIf((o) => o.avatarUrl != null && o.avatarUrl !== '')
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  /** Country or region/city for "artists in your area" (e.g. "US", "US-Georgia") */
  @IsString()
  @IsOptional()
  region?: string;

  /** Whether to suggest artists in user's area on login */
  @IsBoolean()
  @IsOptional()
  suggestLocalArtists?: boolean;

  /** Artist or Catalyst (service provider) bio */
  @IsString()
  @IsOptional()
  bio?: string;

  /** Short tagline (LinkedIn-style headline) */
  @IsString()
  @IsOptional()
  headline?: string;

  /** Location for discovery (e.g. city, region) */
  @IsString()
  @IsOptional()
  locationRegion?: string;

  /** Whether user is discoverable in heatmap/nearby */
  @IsBoolean()
  @IsOptional()
  discoverable?: boolean;
}
