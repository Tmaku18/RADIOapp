import { IsUUID, IsInt, Min, Max, IsIn } from 'class-validator';

const ALLOWED_PLAYS = [1, 3, 5, 10, 25, 50, 100] as const;

export class BuySongPlaysDto {
  @IsUUID()
  songId: string;

  /**
   * Number of discovery placements to purchase. Each placement is a flat $1.99
   * and grants ~1,000 verified listener exposures (plays) to the song. The
   * field keeps the `plays` name for client/IAP wire compatibility.
   */
  @IsInt()
  @Min(1)
  @Max(100)
  @IsIn(ALLOWED_PLAYS)
  plays: (typeof ALLOWED_PLAYS)[number];
}

export const ALLOWED_PLAYS_LIST = [...ALLOWED_PLAYS];
