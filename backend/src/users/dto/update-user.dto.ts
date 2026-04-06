import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUrl,
  IsBoolean,
  ValidateIf,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import {
  normalizeInstagramUrl,
  normalizeFacebookUrl,
  normalizeAppleMusicUrl,
  normalizeSoundcloudUrl,
  normalizeSnapchatUrl,
  normalizeSpotifyUrl,
  normalizeTwitterUrl,
  normalizeTiktokUrl,
  normalizeWebsiteUrl,
  normalizeYoutubeUrl,
} from '../utils/normalize-social-url';

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

  /** Artist social links */
  @Transform(({ value }) => normalizeInstagramUrl(value))
  @ValidateIf((o) => o.instagramUrl != null && o.instagramUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  instagramUrl?: string;

  @Transform(({ value }) => normalizeTwitterUrl(value))
  @ValidateIf((o) => o.twitterUrl != null && o.twitterUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  twitterUrl?: string;

  @Transform(({ value }) => normalizeYoutubeUrl(value))
  @ValidateIf((o) => o.youtubeUrl != null && o.youtubeUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  youtubeUrl?: string;

  @Transform(({ value }) => normalizeTiktokUrl(value))
  @ValidateIf((o) => o.tiktokUrl != null && o.tiktokUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  tiktokUrl?: string;

  @Transform(({ value }) => normalizeWebsiteUrl(value))
  @ValidateIf((o) => o.websiteUrl != null && o.websiteUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  websiteUrl?: string;

  @Transform(({ value }) => normalizeSoundcloudUrl(value))
  @ValidateIf((o) => o.soundcloudUrl != null && o.soundcloudUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  soundcloudUrl?: string;

  @Transform(({ value }) => normalizeSpotifyUrl(value))
  @ValidateIf((o) => o.spotifyUrl != null && o.spotifyUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  spotifyUrl?: string;

  @Transform(({ value }) => normalizeAppleMusicUrl(value))
  @ValidateIf((o) => o.appleMusicUrl != null && o.appleMusicUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  appleMusicUrl?: string;

  @Transform(({ value }) => normalizeFacebookUrl(value))
  @ValidateIf((o) => o.facebookUrl != null && o.facebookUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  facebookUrl?: string;

  @Transform(({ value }) => normalizeSnapchatUrl(value))
  @ValidateIf((o) => o.snapchatUrl != null && o.snapchatUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  snapchatUrl?: string;

  /** Artist map latitude for discovery map. */
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  artistLat?: number;

  /** Artist map longitude for discovery map. */
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  artistLng?: number;
}
