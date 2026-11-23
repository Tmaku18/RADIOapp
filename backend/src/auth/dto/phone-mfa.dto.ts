import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class SendPhoneMfaDto {
  @IsOptional()
  @IsString()
  @Length(7, 32)
  phone?: string;
}

export class VerifyPhoneMfaDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
