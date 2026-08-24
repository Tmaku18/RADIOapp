import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/services/play_billing_service.dart';

void main() {
  group('PlayBillingService.describeStoreError', () {
    final billing = PlayBillingService.instance;

    test('maps StoreKit no-response errors without leaking store setup steps',
        () {
      final message = billing.describeStoreError(
        PlatformException(
          code: 'storekit_no_response',
          message: 'Failed to get response from platform.',
        ),
        productId: 'pro_networx_monthly',
      );
      expect(message, contains('temporarily unavailable'));
      expect(message, isNot(contains('Paid Apps Agreement')));
      expect(message, isNot(contains('pro_networx_monthly')));
    });

    test('maps product not found without leaking the product id', () {
      final message = billing.describeStoreError(
        Exception('Product xyz not found'),
        productId: 'xyz',
      );
      expect(message, contains('isn’t available yet'));
      expect(message, isNot(contains('xyz')));
    });

    test('recognizes user cancellation', () {
      expect(
        billing.isPurchaseCancellation(Exception('Purchase was cancelled.')),
        isTrue,
      );
      expect(
        billing.isPurchaseCancellation(Exception('Network error')),
        isFalse,
      );
    });

    test('strips nested Exception prefixes', () {
      final message = billing.describeStoreError(
        Exception('Exception: Exception: boom'),
      );
      expect(message, 'boom');
    });
  });

  group('PlayBillingService product IDs', () {
    test('pro-networx monthly id is stable', () {
      expect(
        PlayBillingService.instance.proNetworxMonthlyProductId,
        isNotEmpty,
      );
    });
  });
}
