import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import '../../../core/constants/pro_radio_pricing.dart';
import '../../../core/services/payments_service.dart';
import '../../../core/services/play_billing_service.dart';
import '../../../core/services/pro_radio_service.dart';
import '../../../core/utils/mobile_store.dart';

/// Subscribe to Pro-Radio ($9.99/mo, $4.99 first month).
class ProRadioPaywallSheet extends StatefulWidget {
  const ProRadioPaywallSheet({
    super.key,
    this.title = 'Subscribe to Pro-Radio',
    this.description =
        'Full on-demand listening, personal playlists, and a controllable player. Cancel anytime.',
  });

  final String title;
  final String description;

  static Future<bool?> show(
    BuildContext context, {
    String? title,
    String? description,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => ProRadioPaywallSheet(
        title: title ?? 'Subscribe to Pro-Radio',
        description: description ??
            'Full on-demand listening, personal playlists, and a controllable player.',
      ),
    );
  }

  @override
  State<ProRadioPaywallSheet> createState() => _ProRadioPaywallSheetState();
}

class _ProRadioPaywallSheetState extends State<ProRadioPaywallSheet> {
  final ProRadioService _service = ProRadioService();
  final PaymentsService _payments = PaymentsService();
  bool _busy = false;
  bool _loadingProduct = false;
  String? _storePriceLabel;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (isMobileStorePlatform) unawaited(_prefetchStoreProduct());
  }

  Future<void> _prefetchStoreProduct() async {
    setState(() {
      _loadingProduct = true;
      _error = null;
    });
    final productId = PlayBillingService.instance.proRadioMonthlyProductId;
    try {
      final product =
          await PlayBillingService.instance.getProductDetails(productId);
      if (!mounted) return;
      setState(() {
        _storePriceLabel = product.price;
        _loadingProduct = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProduct = false;
        _error = PlayBillingService.instance.describeStoreError(
          e,
          productId: productId,
        );
      });
    }
  }

  Future<void> _subscribeWithStore() async {
    final productId = PlayBillingService.instance.proRadioMonthlyProductId;
    final purchase =
        await PlayBillingService.instance.buySubscription(productId);
    if (Platform.isIOS) {
      await _payments.completeAppStoreSubscription(
        productId: purchase.productId,
        signedTransaction: purchase.purchaseToken,
        transactionId: purchase.transactionId,
      );
    } else {
      await _payments.completeGooglePlaySubscription(
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
      );
    }
  }

  Future<void> _subscribeWithStripe() async {
    final res = await _service.createPaymentSheet();
    final clientSecret = res['setupIntentClientSecret']?.toString();
    final customerId = res['customerId']?.toString();
    final ephemeralKey = res['ephemeralKeySecret']?.toString();
    final publishableKey = res['publishableKey']?.toString();
    if (clientSecret == null || clientSecret.isEmpty) {
      throw Exception('Missing setup intent.');
    }
    if (publishableKey != null && publishableKey.isNotEmpty) {
      Stripe.publishableKey = publishableKey;
      await Stripe.instance.applySettings();
    }
    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        setupIntentClientSecret: clientSecret,
        merchantDisplayName: 'Pro-Radio',
        customerId: customerId,
        customerEphemeralKeySecret: ephemeralKey,
        style: ThemeMode.system,
      ),
    );
    await Stripe.instance.presentPaymentSheet();
  }

  Future<void> _subscribe() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (isMobileStorePlatform) {
        await _subscribeWithStore();
      } else {
        await _subscribeWithStripe();
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on StripeException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.error.localizedMessage ?? 'Payment cancelled');
    } catch (e) {
      if (!mounted) return;
      final productId = PlayBillingService.instance.proRadioMonthlyProductId;
      setState(() {
        _error = isMobileStorePlatform
            ? PlayBillingService.instance.describeStoreError(
                e,
                productId: productId,
              )
            : 'Could not start checkout: $e';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final storeCheckout = isMobileStorePlatform;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.radio, color: cs.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.title,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(widget.description, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$proRadioRegularDisplay/mo',
                  style: theme.textTheme.titleMedium?.copyWith(
                    decoration: TextDecoration.lineThrough,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  proRadioIntroDisplay,
                  style: theme.textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(width: 4),
                Text(
                  'first month, then $proRadioRegularDisplay/mo',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: cs.onSurfaceVariant),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: cs.error)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: (_busy ||
                        _loadingProduct ||
                        (storeCheckout && _storePriceLabel == null))
                    ? null
                    : _subscribe,
                child: _busy || _loadingProduct
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        storeCheckout
                            ? 'Subscribe with $mobileStoreLabel'
                            : 'Subscribe',
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
