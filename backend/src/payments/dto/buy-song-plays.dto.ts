import { IsUUID, IsInt, Min, Max, IsIn } from 'class-validator';

const ALLOWED_PLAYS = [1, 3, 5, 10, 25, 50, 100] as const;

export class BuySongPlaysDto {
  @IsUUID()
  songId: string;

  /**
   * Number of discovery placements to purchase. One is $1.99. Packs are $4.99
   * for 3, $9.99 for 5, $17.99 for 10, $39.99 for 25, $75.99 for 50, and $150
   * for 100. Each placement grants ~100 verified listener exposures. The
   * field keeps the `plays` name for client/IAP wire compatibility.
   */
  @IsInt()
  @Min(1)
  @Max(100)
  @IsIn(ALLOWED_PLAYS)
  plays: (typeof ALLOWED_PLAYS)[number];
}

export const ALLOWED_PLAYS_LIST = [...ALLOWED_PLAYS];
