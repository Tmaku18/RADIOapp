import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateServiceListingDto {
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  serviceType: string;

  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rateCents?: number;

  @IsOptional()
  @IsIn(['hourly', 'fixed'])
  rateType?: 'hourly' | 'fixed';

  @IsOptional()
  @IsIn(['active', 'paused'])
  status?: 'active' | 'paused';
}

