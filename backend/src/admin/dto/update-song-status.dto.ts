import { IsString, IsIn } from 'class-validator';

export class UpdateSongStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';
}
