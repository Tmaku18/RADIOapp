import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EducationItemDto {
  @IsString()
  @MaxLength(200)
  school!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  field?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  startYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  endYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
