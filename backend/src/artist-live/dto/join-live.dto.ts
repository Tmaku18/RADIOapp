import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinLiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;

  // Stable per-device token so refreshes/reconnects from the same anonymous
  // viewer are de-duplicated in the concurrent-viewer count.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  viewerToken?: string;
}

export class ViewerPresenceDto {
  @IsString()
  @MaxLength(64)
  viewerId!: string;
}
