import { IsNumber, IsPositive } from 'class-validator';

export class AllocateCreditsDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
