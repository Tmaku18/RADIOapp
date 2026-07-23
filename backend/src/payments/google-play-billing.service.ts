import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

type GooglePlayProductPurchase = {
  orderId: string | null;
  purchaseState: number | null;
  consumptionState: number | null;
  acknowledgementState: number | null;
};

export type GooglePlaySubscriptionPurchase = {
  orderId: string | null;
  productId: string;
  purchaseToken: string;
  subscriptionState: string | null;
  expiryTime: Date | null;
  acknowledgementState: string | null;
  isEntitled: boolean;
};

function normalizeServiceAccountPrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n?/g, '\n').trim();
  if (!key.endsWith('\n')) key = `${key}\n`;
  return key;
}

@Injectable()
export class GooglePlayBillingService {
  constructor(private readonly configService: ConfigService) {}

  private getPackageName(): string {
    const pkg = this.configService.get<string>('GOOGLE_PLAY_PACKAGE_NAME');
    if (!pkg) {
      throw new Error(
        'GOOGLE_PLAY_PACKAGE_NAME is required for Google Play Billing verification',
      );
    }
    return pkg;
  }

  private getServiceAccountCredentials(): {
    client_email: string;
    private_key: string;
  } {
    const json = this.configService.get<string>(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON',
    );
    if (json) {
      const parsed = JSON.parse(json) as {
        client_email?: string;
        private_key?: string;
      };
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: normalizeServiceAccountPrivateKey(parsed.private_key),
        };
      }
    }

    const fallbackEmail = this.configService.get<string>(
      'FIREBASE_CLIENT_EMAIL',
    );
    const fallbackKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (fallbackEmail && fallbackKey) {
      return {
        client_email: fallbackEmail,
        private_key: normalizeServiceAccountPrivateKey(fallbackKey),
      };
    }

    throw new Error(
      'Missing Google Play service account credentials. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON ' +
        'or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY with Android Publisher access.',
    );
  }

  async verifyManagedProductPurchase(params: {
    productId: string;
    purchaseToken: string;
  }): Promise<GooglePlayProductPurchase> {
    const credentials = this.getServiceAccountCredentials();
    const packageName = this.getPackageName();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth,
    });

    const purchaseRes = await androidPublisher.purchases.products.get({
      packageName,
      productId: params.productId,
      token: params.purchaseToken,
    });
    const purchase = purchaseRes.data;

    if ((purchase.purchaseState ?? 1) !== 0) {
      throw new Error('Google Play purchase is not in PURCHASED state');
    }

    if ((purchase.acknowledgementState ?? 0) === 0) {
      await androidPublisher.purchases.products.acknowledge({
        packageName,
        productId: params.productId,
        token: params.purchaseToken,
        requestBody: {},
      });
    }

    // Most of our products are expected to be consumables.
    if ((purchase.consumptionState ?? 0) === 0) {
      await androidPublisher.purchases.products.consume({
        packageName,
        productId: params.productId,
        token: params.purchaseToken,
      });
    }

    return {
      orderId: purchase.orderId ?? null,
      purchaseState: purchase.purchaseState ?? null,
      consumptionState: purchase.consumptionState ?? null,
      acknowledgementState: purchase.acknowledgementState ?? null,
    };
  }

  private async getAndroidPublisher() {
    const credentials = this.getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    return google.androidpublisher({
      version: 'v3',
      auth,
    });
  }

  /**
   * Verify a Play Billing subscription via purchases.subscriptionsv2.get,
   * then acknowledge via the v1 subscriptions API when needed.
   */
  async verifySubscriptionPurchase(params: {
    productId: string;
    purchaseToken: string;
    requireActive?: boolean;
  }): Promise<GooglePlaySubscriptionPurchase> {
    const packageName = this.getPackageName();
    const androidPublisher = await this.getAndroidPublisher();

    const purchaseRes = await androidPublisher.purchases.subscriptionsv2.get({
      packageName,
      token: params.purchaseToken,
    });
    const purchase = purchaseRes.data;
    const lineItems = purchase.lineItems ?? [];
    const matching =
      lineItems.find((item) => item.productId === params.productId) ??
      lineItems[0];
    if (!matching?.productId) {
      throw new Error('Google Play subscription has no line items');
    }
    if (matching.productId !== params.productId) {
      throw new Error(
        `Google Play subscription product mismatch. Expected ${params.productId}, got ${matching.productId}`,
      );
    }

    const subscriptionState = purchase.subscriptionState ?? null;
    const entitledStates = new Set([
      'SUBSCRIPTION_STATE_ACTIVE',
      'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      'SUBSCRIPTION_STATE_ON_HOLD',
    ]);
    const isEntitled =
      subscriptionState != null && entitledStates.has(subscriptionState);

    if (params.requireActive !== false && !isEntitled) {
      throw new Error(
        `Google Play subscription is not entitled (state=${subscriptionState ?? 'unknown'})`,
      );
    }

    const acknowledgementState = purchase.acknowledgementState ?? null;
    if (acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
      await androidPublisher.purchases.subscriptions.acknowledge({
        packageName,
        subscriptionId: params.productId,
        token: params.purchaseToken,
        requestBody: {},
      });
    }

    const expiryRaw = matching.expiryTime ?? null;
    const expiryTime = expiryRaw ? new Date(expiryRaw) : null;
    const orderId =
      (purchase as { latestOrderId?: string | null }).latestOrderId ?? null;

    return {
      orderId,
      productId: matching.productId,
      purchaseToken: params.purchaseToken,
      subscriptionState,
      expiryTime,
      acknowledgementState,
      isEntitled,
    };
  }
}
