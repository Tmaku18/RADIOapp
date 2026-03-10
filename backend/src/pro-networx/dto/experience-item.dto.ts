import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ExperienceItemDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(200)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  current?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
