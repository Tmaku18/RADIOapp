import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/services/play_billing_service.dart';

void main() {
  group('PlayBillingService.describeStoreError', () {
    final billing = PlayBillingService.instance;

    test('maps StoreKit no-response errors', () {
      final message = billing.describeStoreError(
        PlatformException(
          code: 'storekit_no_response',
          message: 'Failed to get response from platform.',
        ),
        productId: 'pro_networx_monthly',
      );
      expect(message, contains('App Store could not load'));
      expect(message, contains('Paid Apps Agreement'));
      expect(message, contains('pro_networx_monthly'));
    });

    test('maps product not found', () {
      final message = billing.describeStoreError(
        Exception('Product xyz not found'),
        productId: 'xyz',
      );
      expect(message, contains('not available'));
      expect(message, contains('xyz'));
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
