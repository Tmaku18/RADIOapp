import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateProProfileDto {
  @IsOptional()
  @IsBoolean()
  availableForWork?: boolean;

  @IsOptional()
  @IsString()
  skillsHeadline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillNames?: string[];
}

