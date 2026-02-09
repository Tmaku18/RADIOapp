import { IsEmail, IsString, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsIn(['listener', 'artist', 'service_provider'])
  role: 'listener' | 'artist' | 'service_provider';
}
