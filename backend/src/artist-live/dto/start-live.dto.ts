import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartLiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  // Explicit host intent so a stream launched from the "Go live as DJ" flow is
  // classified as a DJ set even when the account role isn't literally `dj`.
  @IsOptional()
  @IsIn(['dj', 'artist'])
  hostType?: 'dj' | 'artist';
}
