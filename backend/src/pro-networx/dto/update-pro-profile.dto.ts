import {
  IsArray,
  IsBoolean,
  IsUrl,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExperienceItemDto } from './experience-item.dto';
import { EducationItemDto } from './education-item.dto';
import { FeaturedItemDto } from './featured-item.dto';
import {
  normalizeInstagramUrl,
  normalizeTwitterUrl,
  normalizeYoutubeUrl,
  normalizeTiktokUrl,
  normalizeWebsiteUrl,
  normalizeSoundcloudUrl,
  normalizeSpotifyUrl,
  normalizeAppleMusicUrl,
  normalizeFacebookUrl,
  normalizeSnapchatUrl,
} from '../../users/utils/normalize-social-url';

export class UpdateProProfileDto {
  @IsOptional()
  @IsBoolean()
  availableForWork?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  skillsHeadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  about?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => normalizeWebsiteUrl(value))
  @ValidateIf((o) => o.websiteUrl != null && o.websiteUrl !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  websiteUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceItemDto)
  @ArrayMaxSize(20)
  experience?: ExperienceItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationItemDto)
  @ArrayMaxSize(10)
  education?: EducationItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeaturedItemDto)
  @ArrayMaxSize(5)
  featured?: FeaturedItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillNames?: string[];

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
}
