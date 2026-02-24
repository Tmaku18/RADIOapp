import { IsBooleanString, IsIn, IsOptional, IsString } from 'class-validator';

export class ListProDirectoryDto {
  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @IsBooleanString()
  availableForWork?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';
}

