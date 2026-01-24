import { IsNumber, IsPositive, Min } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsNumber()
  @Min(100) // Minimum $1.00 in cents
  amount: number;

  @IsNumber()
  @IsPositive()
  credits: number;
}
