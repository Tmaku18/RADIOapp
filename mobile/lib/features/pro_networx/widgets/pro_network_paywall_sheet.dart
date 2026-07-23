import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import '../../../core/constants/pro_networx_pricing.dart';
import '../../../core/services/payments_service.dart';
import '../../../core/services/play_billing_service.dart';
import '../../../core/services/pro_networx_service.dart';
import '../../../core/utils/mobile_store.dart';

/// Bottom sheet that walks the user through subscribing to Pro-Networx.
/// On iOS/Android uses App Store / Google Play; elsewhere uses Stripe PaymentSheet.
/// Returns true via [Navigator.pop] when the user completes the flow successfully.
class ProNetworkPaywallSheet extends StatefulWidget {
  const ProNetworkPaywallSheet({
    super.key,
    this.title = 'Subscribe to Pro-Networx',
    this.description = 'Direct messaging and contact info unlock with a '
        'subscription. Cancel anytime.',
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
      builder: (_) => ProNetworkPaywallSheet(
        title: title ?? 'Subscribe to Pro-Networx',
        description: description ??
            'Direct messaging and contact info unlock with a subscription.',
      ),
    );
  }

  @override
  State<ProNetworkPaywallSheet> createState() => _ProNetworkPaywallSheetState();
}

class _ProNetworkPaywallSheetState extends State<ProNetworkPaywallSheet> {
  final ProNetworxService _service = ProNetworxService();
  final PaymentsService _payments = PaymentsService();
  bool _busy = false;
  String? _error;

  Future<void> _subscribeWithStore() async {
    final productId =
        PlayBillingService.instance.proNetworxMonthlyProductId;
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

  Future<void> _restoreWithStore() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final productId =
          PlayBillingService.instance.proNetworxMonthlyProductId;
      final purchase =
          await PlayBillingService.instance.restoreSubscription(productId);
      if (purchase == null) {
        throw Exception('No active Pro-Networx subscription found to restore.');
      }
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
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Restore failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _subscribeWithStripe() async {
    final res = await _service.createProNetworxPaymentSheet();
    final clientSecret = (res['setupIntentClientSecret'])?.toString();
    final customerId = (res['customerId'])?.toString();
    final ephemeralKey = (res['ephemeralKeySecret'])?.toString();
    final publishableKey = (res['publishableKey'])?.toString();
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
        merchantDisplayName: 'Pro-Networx',
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
      setState(() {
        _error = e.error.localizedMessage ?? 'Payment was cancelled';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not start checkout: $e';
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
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
                Icon(Icons.lock_outline, color: cs.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    widget.title,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              widget.description,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: cs.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '$proNetworxRegularDisplay/mo',
                  style: theme.textTheme.titleMedium?.copyWith(
                    decoration: TextDecoration.lineThrough,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  proNetworxIntroDisplay,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 4),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    'first month',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: cs.onSurfaceVariant),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              storeCheckout
                  ? 'Then $proNetworxRegularDisplay/mo via $mobileStoreLabel. '
                      'Cancel in ${Platform.isIOS ? 'Settings → Apple ID → Subscriptions' : 'Google Play → Payments & subscriptions'}.'
                  : 'Then $proNetworxRegularDisplay/mo. Cancel anytime.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: cs.onSurfaceVariant,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: TextStyle(color: cs.error)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : _subscribe,
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child:
                            CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        storeCheckout
                            ? 'Subscribe with $mobileStoreLabel'
                            : 'Subscribe',
                      ),
              ),
            ),
            if (storeCheckout) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: _busy ? null : _restoreWithStore,
                  child: const Text('Restore purchases'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
