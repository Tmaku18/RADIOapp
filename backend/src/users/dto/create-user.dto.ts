import {
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
  @IsIn(['listener', 'artist', 'service_provider'])
  @IsOptional()
  role?: 'listener' | 'artist' | 'service_provider';
}
