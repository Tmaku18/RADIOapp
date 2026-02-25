import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinLiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
