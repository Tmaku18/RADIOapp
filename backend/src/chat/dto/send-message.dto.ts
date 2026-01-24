import { IsString, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  message: string;

  @IsString()
  @IsOptional()
  songId?: string;
}
