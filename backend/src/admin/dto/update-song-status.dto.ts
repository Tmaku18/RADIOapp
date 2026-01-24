import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateSongStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  reason?: string;
}
