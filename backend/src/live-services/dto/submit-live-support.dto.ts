import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class SubmitLiveSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  discordLink: string;
}
