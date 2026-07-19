import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class FeaturedItemDto {
  @IsString()
  @MaxLength(20)
  type!: 'link' | 'portfolio';

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUUID()
  portfolioItemId?: string;
}
