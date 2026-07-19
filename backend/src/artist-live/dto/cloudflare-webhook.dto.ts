import { IsObject, IsOptional, IsString } from 'class-validator';

export class CloudflareWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsObject()
  data?: {
    input_id?: string;
    event_type?: string;
    updated_at?: string;
    [key: string]: unknown;
  };
}
