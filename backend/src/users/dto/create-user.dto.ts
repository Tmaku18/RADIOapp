import {
  IsBoolean,
  IsEmail,
  IsString,
  IsIn,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsIn(['listener', 'artist', 'service_provider', 'dj', 'musician'])
  @IsOptional()
  role?: 'listener' | 'artist' | 'service_provider' | 'dj' | 'musician';

  /** True when the client showed and the user accepted Terms and Community Guidelines. */
  @IsBoolean()
  @IsOptional()
  termsAccepted?: boolean;
}
