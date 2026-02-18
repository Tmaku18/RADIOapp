import { IsIn, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddPortfolioItemDto {
  @IsIn(['image', 'audio', 'video'])
  type: 'image' | 'audio' | 'video';

  // Supports either public Supabase URLs or external URLs.
  @IsString()
  @MaxLength(2048)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fileUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

