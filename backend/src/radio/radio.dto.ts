import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ReportPlayDto {
  @IsString()
  songId: string;

  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}

export class ListenerPulseDto {
  @IsOptional()
  @IsString()
  streamToken?: string;

  @IsString()
  songId: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class ProspectorScoreDto {
  @IsString()
  songId: string;

  @IsOptional()
  @IsString()
  playId?: string | null;

  @IsNumber()
  score: number;
}

export class ProspectorSessionDto {
  @IsOptional()
  @IsString()
  sessionId?: string | null;
}
