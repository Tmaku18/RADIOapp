import { IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteAppStoreSubscriptionDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsOptional()
  @IsString()
  signedTransaction?: string;

  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class CompleteGooglePlaySubscriptionDto {
  @IsString()
  @MinLength(1)
  productId: string;

  @IsString()
  @MinLength(1)
  purchaseToken: string;
}
