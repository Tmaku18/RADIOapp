import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

type GooglePlayProductPurchase = {
  orderId: string | null;
  purchaseState: number | null;
  consumptionState: number | null;
  acknowledgementState: number | null;
};

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
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
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
        private_key: fallbackKey.replace(/\\n/g, '\n'),
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
}
