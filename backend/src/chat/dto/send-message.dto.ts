import { IsString, IsOptional, MaxLength, IsNotEmpty, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  message: string;

  @IsString()
  @IsOptional()
  songId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  radioId?: string;

  /** `live` is station chat. `comment` is the per-song thread and requires songId. */
  @IsOptional()
  @IsIn(['live', 'comment'])
  kind?: 'live' | 'comment';
}
