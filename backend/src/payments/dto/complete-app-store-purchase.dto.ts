import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CompleteAppStorePurchaseDto {
  @IsString()
  productId: string;

  /** StoreKit 2 JWS from purchase.verificationData.serverVerificationData */
  @IsOptional()
  @IsString()
  signedTransaction?: string;

  /** Flutter PurchaseDetails.purchaseID (App Store transaction id) */
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsUUID()
  songId?: string;
}
