import { IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class UpdateSongStatusDto {
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'])
  status: 'pending' | 'approved' | 'rejected';

  /**
   * Required when status is `rejected` (enforced in AdminService).
   * Shown to the artist and other admins.
   */
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reason?: string;
}
