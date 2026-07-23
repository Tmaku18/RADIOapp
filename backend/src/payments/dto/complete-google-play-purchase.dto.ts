import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteGooglePlayPurchaseDto {
  @IsString()
  productId: string;

  @IsString()
  purchaseToken: string;

  @IsOptional()
  @IsUUID()
  songId?: string;

  /** Required when product type is tip (livestream). */
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
