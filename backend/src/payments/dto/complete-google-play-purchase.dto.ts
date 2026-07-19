import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteGooglePlayPurchaseDto {
  @IsString()
  productId: string;

  @IsString()
  purchaseToken: string;

  @IsOptional()
  @IsUUID()
  songId?: string;
}
