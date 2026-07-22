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
  IsArray,
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

/** Preserve omitted fields; empty/null clears; otherwise normalize. */
function transformOptionalSocialUrl(
  value: unknown,
  normalize: (v: unknown) => string | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return normalize(value) ?? null;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  /** Unique handle (separate from display name). 3-30 chars [a-z0-9_.]. */
  @IsString()
  @IsOptional()
  username?: string;

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

  /** Notify when a followed artist's song is playing on radio */
  @IsBoolean()
  @IsOptional()
  notifyFollowedArtistOnRadio?: boolean;

  /** Genre ids from onboarding (e.g. hip-hop, rap, country). */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  favoriteGenres?: string[];

  /** Mark genre onboarding complete (sets timestamp server-side). */
  @IsBoolean()
  @IsOptional()
  completeGenreOnboarding?: boolean;

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

  /** City for Nearby People map pin + directory */
  @IsString()
  @IsOptional()
  city?: string;

  /** ZIP / postal code for Nearby People directory */
  @IsString()
  @IsOptional()
  zipCode?: string;

  /** Whether user is discoverable in heatmap/nearby */
  @IsBoolean()
  @IsOptional()
  discoverable?: boolean;

  /** Artist social links. Empty string / null clears; omitted leaves unchanged. */
  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeInstagramUrl),
  )
  @ValidateIf((o) => o.instagramUrl != null && o.instagramUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  instagramUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeTwitterUrl),
  )
  @ValidateIf((o) => o.twitterUrl != null && o.twitterUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  twitterUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeYoutubeUrl),
  )
  @ValidateIf((o) => o.youtubeUrl != null && o.youtubeUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  youtubeUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeTiktokUrl),
  )
  @ValidateIf((o) => o.tiktokUrl != null && o.tiktokUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  tiktokUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeWebsiteUrl),
  )
  @ValidateIf((o) => o.websiteUrl != null && o.websiteUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  websiteUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeSoundcloudUrl),
  )
  @ValidateIf((o) => o.soundcloudUrl != null && o.soundcloudUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  soundcloudUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeSpotifyUrl),
  )
  @ValidateIf((o) => o.spotifyUrl != null && o.spotifyUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  spotifyUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeAppleMusicUrl),
  )
  @ValidateIf((o) => o.appleMusicUrl != null && o.appleMusicUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  appleMusicUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeFacebookUrl),
  )
  @ValidateIf((o) => o.facebookUrl != null && o.facebookUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  facebookUrl?: string | null;

  @Transform(({ value }) =>
    transformOptionalSocialUrl(value, normalizeSnapchatUrl),
  )
  @ValidateIf((o) => o.snapchatUrl != null && o.snapchatUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  snapchatUrl?: string | null;

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
