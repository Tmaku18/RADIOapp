import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateArtistLikeNotificationSettingsDto {
  @IsBoolean()
  @IsOptional()
  muted?: boolean;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  minLikesTrigger?: number;

  @IsInt()
  @Min(0)
  @Max(10080)
  @IsOptional()
  cooldownMinutes?: number;
}
