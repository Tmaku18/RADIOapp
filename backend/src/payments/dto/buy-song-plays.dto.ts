import { IsUUID, IsInt, Min, Max, IsIn } from 'class-validator';

const ALLOWED_PLAYS = [1, 3, 5, 10, 25, 50, 100] as const;

export class BuySongPlaysDto {
  @IsUUID()
  songId: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsIn(ALLOWED_PLAYS)
  plays: (typeof ALLOWED_PLAYS)[number];
}

export const ALLOWED_PLAYS_LIST = [...ALLOWED_PLAYS];
