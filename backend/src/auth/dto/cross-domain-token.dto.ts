import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCrossDomainTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsNotEmpty()
  targetHost: string;
}

export class ExchangeCrossDomainTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  currentHost: string;
}
