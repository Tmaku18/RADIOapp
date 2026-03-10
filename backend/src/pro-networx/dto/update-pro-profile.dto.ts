import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceItemDto } from './experience-item.dto';
import { EducationItemDto } from './education-item.dto';
import { FeaturedItemDto } from './featured-item.dto';

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
}

