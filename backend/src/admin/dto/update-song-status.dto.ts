import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateSongStatusDto {
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'])
  status: 'pending' | 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  reason?: string;
}
