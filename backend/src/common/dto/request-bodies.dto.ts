import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class OptionalTitleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class TitleBodyDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SongIdDto {
  @IsString()
  songId: string;
}

export class SongIdListDto {
  @IsArray()
  @IsString({ each: true })
  songIds: string[];
}

export class OptionalPlacementsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  placements?: number;
}

export class AppleAuthorizationDto {
  @IsOptional()
  @IsString()
  authorizationCode?: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequiredReasonDto {
  @IsString()
  reason: string;
}

export class TextBodyDto {
  @IsString()
  body: string;
}

export class OptionalTextBodyDto {
  @IsOptional()
  @IsString()
  body?: string;
}

export class EmojiBodyDto {
  @IsString()
  emoji: string;
}

export class OptionalUploadSlotDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class UploadSlotDto {
  @IsString()
  filename: string;

  @IsString()
  contentType: string;
}

export class FileNameSlotDto {
  @IsString()
  fileName: string;

  @IsString()
  contentType: string;
}

export class StackIdsDto {
  @IsArray()
  @IsString({ each: true })
  stackIds: string[];
}

export class DuckVolumeDto {
  @IsNumber()
  duckVolume: number;
}

export class CheckoutUrlsDto {
  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

export class ReturnUrlsDto {
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  refreshUrl?: string;
}

export class SignedPayloadDto {
  @IsOptional()
  @IsString()
  signedPayload?: string;
}

export class RadioIdsDto {
  @IsArray()
  @IsString({ each: true })
  radioIds: string[];
}

export class EnabledDto {
  @IsBoolean()
  enabled: boolean;
}

export class ModerationActionDto {
  @IsIn(['approve', 'reject', 'revoke'])
  action: 'approve' | 'reject' | 'revoke';
}

export class ReactionDto {
  @IsOptional()
  @IsString()
  playId?: string;

  @IsOptional()
  @IsIn(['fire', 'shit'])
  reaction?: 'fire' | 'shit';
}

export class ChatToggleDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class DurationHoursDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  durationHours?: number;
}

export class OptionalMessageDto {
  @IsOptional()
  @IsString()
  message?: string | null;
}

export class AmountMessageDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  message?: string;
}

export class ChatMessageDto {
  @IsString()
  message: string;
}

export class BannedDto {
  @IsBoolean()
  banned: boolean;
}

export class FavoritedDto {
  @IsOptional()
  @IsBoolean()
  favorited?: boolean;
}

export class RatingDto {
  @IsOptional()
  @IsInt()
  rating?: number | null;
}

export class CaptionDto {
  @IsOptional()
  @IsString()
  caption?: string;
}

export class ClipWindowDto {
  @IsOptional()
  @IsNumber()
  startSeconds?: number;

  @IsOptional()
  @IsNumber()
  endSeconds?: number;
}
