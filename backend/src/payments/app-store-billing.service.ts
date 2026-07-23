import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';

export type AppStoreVerifiedPurchase = {
  transactionId: string;
  originalTransactionId: string | null;
  productId: string;
  bundleId: string | null;
  purchaseDate: number | null;
  expiresDate: number | null;
  environment: string | null;
  quantity: number;
  type: string | null;
};

export type AppStoreNotificationResult = {
  notificationType: string | null;
  subtype: string | null;
  transaction: AppStoreVerifiedPurchase | null;
};

function normalizePemKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').trim();
}

function looksLikeJws(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

@Injectable()
export class AppStoreBillingService {
  private readonly logger = new Logger(AppStoreBillingService.name);

  constructor(private readonly configService: ConfigService) {}

  private getBundleId(): string {
    return (
      this.configService.get<string>('APPLE_IAP_BUNDLE_ID') ??
      'com.tmaktechnologies.networxradio'
    );
  }

  private getConfiguredEnvironment(): Environment {
    const raw = (
      this.configService.get<string>('APPLE_IAP_ENVIRONMENT') ?? 'Sandbox'
    ).trim();
    if (raw.toLowerCase() === 'production') return Environment.PRODUCTION;
    return Environment.SANDBOX;
  }

  private getAppAppleId(): number | undefined {
    const raw = this.configService.get<string>('APPLE_APP_APPLE_ID');
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async loadAppleRootCertificates(): Promise<Buffer[]> {
    const configuredDir = this.configService.get<string>(
      'APPLE_IAP_ROOT_CERTS_DIR',
    );
    const certDir = configuredDir || join(process.cwd(), 'certs', 'apple');
    const entries = await fs.readdir(certDir);
    const certFiles = entries.filter((name) =>
      /\.(cer|der|pem)$/i.test(name),
    );
    if (certFiles.length === 0) {
      throw new Error(
        `No Apple root certificates found in ${certDir}. ` +
          'Download Apple Root CA certs into backend/certs/apple/.',
      );
    }
    return Promise.all(
      certFiles.map((name) => fs.readFile(join(certDir, name))),
    );
  }

  private async createVerifier(
    environment: Environment,
  ): Promise<SignedDataVerifier> {
    const rootCerts = await this.loadAppleRootCertificates();
    const appAppleId = this.getAppAppleId();
    if (environment === Environment.PRODUCTION && appAppleId == null) {
      throw new Error(
        'APPLE_APP_APPLE_ID is required when APPLE_IAP_ENVIRONMENT=Production',
      );
    }
    return new SignedDataVerifier(
      rootCerts,
      true,
      environment,
      this.getBundleId(),
      appAppleId,
    );
  }

  private createApiClient(environment: Environment): AppStoreServerAPIClient {
    const keyId = this.configService.get<string>('APPLE_IAP_KEY_ID');
    const issuerId = this.configService.get<string>('APPLE_IAP_ISSUER_ID');
    const privateKeyRaw = this.configService.get<string>('APPLE_IAP_PRIVATE_KEY');
    if (!keyId || !issuerId || !privateKeyRaw) {
      throw new Error(
        'Missing App Store Server API credentials. Set APPLE_IAP_KEY_ID, ' +
          'APPLE_IAP_ISSUER_ID, and APPLE_IAP_PRIVATE_KEY.',
      );
    }
    return new AppStoreServerAPIClient(
      normalizePemKey(privateKeyRaw),
      keyId,
      issuerId,
      this.getBundleId(),
      environment,
    );
  }

  private toVerifiedPurchase(
    decoded: JWSTransactionDecodedPayload,
  ): AppStoreVerifiedPurchase {
    if (!decoded.transactionId) {
      throw new Error('App Store transaction is missing transactionId');
    }
    if (!decoded.productId) {
      throw new Error('App Store transaction is missing productId');
    }
    if (decoded.revocationDate != null) {
      throw new Error('App Store transaction has been revoked/refunded');
    }
    return {
      transactionId: decoded.transactionId,
      originalTransactionId: decoded.originalTransactionId ?? null,
      productId: decoded.productId,
      bundleId: decoded.bundleId ?? null,
      purchaseDate: decoded.purchaseDate ?? null,
      expiresDate: decoded.expiresDate ?? null,
      environment: decoded.environment ?? null,
      quantity: decoded.quantity ?? 1,
      type: decoded.type ?? null,
    };
  }

  private assertSubscriptionActive(verified: AppStoreVerifiedPurchase): void {
    if (
      verified.expiresDate != null &&
      verified.expiresDate <= Date.now()
    ) {
      throw new Error('App Store subscription is expired');
    }
  }

  private async verifyJwsWithFallback(
    signedTransaction: string,
  ): Promise<JWSTransactionDecodedPayload> {
    const preferred = this.getConfiguredEnvironment();
    const environments =
      preferred === Environment.PRODUCTION
        ? [Environment.PRODUCTION, Environment.SANDBOX]
        : [Environment.SANDBOX, Environment.PRODUCTION];

    let lastError: unknown;
    for (const environment of environments) {
      try {
        const verifier = await this.createVerifier(environment);
        return await verifier.verifyAndDecodeTransaction(signedTransaction);
      } catch (error) {
        lastError = error;
        if (
          error instanceof VerificationException &&
          error.status === VerificationStatus.INVALID_ENVIRONMENT
        ) {
          this.logger.warn(
            `App Store JWS environment mismatch for ${environment}; trying next`,
          );
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to verify App Store signed transaction');
  }

  private async fetchTransactionViaApi(
    transactionId: string,
  ): Promise<JWSTransactionDecodedPayload> {
    const preferred = this.getConfiguredEnvironment();
    const environments =
      preferred === Environment.PRODUCTION
        ? [Environment.PRODUCTION, Environment.SANDBOX]
        : [Environment.SANDBOX, Environment.PRODUCTION];

    let lastError: unknown;
    for (const environment of environments) {
      try {
        const client = this.createApiClient(environment);
        const response = await client.getTransactionInfo(transactionId);
        const signed = response.signedTransactionInfo;
        if (!signed) {
          throw new Error(
            'App Store Server API returned no signedTransactionInfo',
          );
        }
        const verifier = await this.createVerifier(environment);
        return await verifier.verifyAndDecodeTransaction(signed);
      } catch (error) {
        lastError = error;
        this.logger.warn(
          `App Store getTransactionInfo failed in ${environment}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(`Unable to verify App Store transaction ${transactionId}`);
  }

  /**
   * Verify a StoreKit purchase. Prefer the device JWS (`signedTransaction`);
   * fall back to App Store Server API lookup by `transactionId`.
   */
  async verifyConsumablePurchase(params: {
    productId: string;
    signedTransaction?: string;
    transactionId?: string;
  }): Promise<AppStoreVerifiedPurchase> {
    let decoded: JWSTransactionDecodedPayload | null = null;

    const signed = (params.signedTransaction ?? '').trim();
    if (signed && looksLikeJws(signed)) {
      decoded = await this.verifyJwsWithFallback(signed);
    } else if (params.transactionId?.trim()) {
      decoded = await this.fetchTransactionViaApi(params.transactionId.trim());
    } else if (signed) {
      throw new Error(
        'App Store purchase payload is not a StoreKit 2 JWS. ' +
          'Pass transactionId so the server can look up the purchase, ' +
          'or upgrade the iOS client to StoreKit 2 verification data.',
      );
    } else {
      throw new Error(
        'signedTransaction or transactionId is required for App Store verification',
      );
    }

    const verified = this.toVerifiedPurchase(decoded);
    if (verified.productId !== params.productId) {
      throw new Error(
        `App Store product mismatch. Expected ${params.productId}, got ${verified.productId}`,
      );
    }
    return verified;
  }

  /**
   * Verify an auto-renewable subscription purchase (StoreKit JWS or API lookup).
   */
  async verifySubscriptionPurchase(params: {
    productId: string;
    signedTransaction?: string;
    transactionId?: string;
    requireActive?: boolean;
  }): Promise<AppStoreVerifiedPurchase> {
    const verified = await this.verifyConsumablePurchase({
      productId: params.productId,
      signedTransaction: params.signedTransaction,
      transactionId: params.transactionId,
    });
    if (params.requireActive !== false) {
      this.assertSubscriptionActive(verified);
    }
    return verified;
  }

  async verifyNotification(
    signedPayload: string,
  ): Promise<AppStoreNotificationResult> {
    const preferred = this.getConfiguredEnvironment();
    const environments =
      preferred === Environment.PRODUCTION
        ? [Environment.PRODUCTION, Environment.SANDBOX]
        : [Environment.SANDBOX, Environment.PRODUCTION];

    let lastError: unknown;
    for (const environment of environments) {
      try {
        const verifier = await this.createVerifier(environment);
        const notification =
          await verifier.verifyAndDecodeNotification(signedPayload);
        let transaction: AppStoreVerifiedPurchase | null = null;
        const signedTx = notification.data?.signedTransactionInfo;
        if (signedTx) {
          const decoded = await verifier.verifyAndDecodeTransaction(signedTx);
          transaction = this.toVerifiedPurchase(decoded);
        }
        return {
          notificationType: notification.notificationType ?? null,
          subtype: notification.subtype ?? null,
          transaction,
        };
      } catch (error) {
        lastError = error;
        if (
          error instanceof VerificationException &&
          error.status === VerificationStatus.INVALID_ENVIRONMENT
        ) {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to verify App Store Server Notification');
  }
}
