import { IsEmail, MaxLength } from 'class-validator';

export class FanEmailDto {
  @IsEmail()
  @MaxLength(254)
  email: string;
}
