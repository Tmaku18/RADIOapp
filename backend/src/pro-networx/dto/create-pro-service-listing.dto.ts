import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for POST /pro-networx/me/services. Mirrors service_listings columns
 * (post-migration 065) with the contact methods + currency that the
 * subscription paywall hides from non-subscribers.
 */
export class CreateProServiceListingDto {
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  serviceType!: string;

  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsIn(['hourly', 'fixed'])
  rateType?: 'hourly' | 'fixed';

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  contactLink?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateProServiceListingDto extends CreateProServiceListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  declare serviceType: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  declare title: string;
}
