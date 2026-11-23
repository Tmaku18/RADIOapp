import {
  IsArray,
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

  /** Maker roles. Empty means listener. Any combination of these four. */
  @IsArray()
  @IsIn(['artist', 'service_provider', 'musician', 'dj'], { each: true })
  @IsOptional()
  userRoles?: Array<'artist' | 'service_provider' | 'musician' | 'dj'>;

  /** True when the client showed and the user accepted Terms and Community Guidelines. */
  @IsBoolean()
  @IsOptional()
  termsAccepted?: boolean;
}
