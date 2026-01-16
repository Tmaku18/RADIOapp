import { IsNumber, IsPositive, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @IsPositive()
  @Min(100) // Minimum $1.00
  amount: number; // in cents

  @IsNumber()
  @IsPositive()
  credits: number;
}
