import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

import '../../../core/constants/pro_bundle_pricing.dart';
import '../../../core/constants/pro_networx_pricing.dart';
import '../../../core/services/payments_service.dart';
import '../../../core/services/play_billing_service.dart';
import '../../../core/services/pro_networx_service.dart';
import '../../../core/utils/mobile_store.dart';

enum _ProPlan { solo, bundle }

/// Subscribe to Pro-Networx ($9.99/mo) or Pro Bundle ($12.99/mo for both).
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
  bool _loadingProduct = false;
  String? _soloStorePrice;
  String? _bundleStorePrice;
  String? _error;
  _ProPlan _plan = _ProPlan.bundle;

  @override
  void initState() {
    super.initState();
    if (isMobileStorePlatform) {
      unawaited(_prefetchStoreProducts());
    }
  }

  String get _activeProductId => _plan == _ProPlan.bundle
      ? PlayBillingService.instance.proBundleMonthlyProductId
      : PlayBillingService.instance.proNetworxMonthlyProductId;

  Future<void> _prefetchStoreProducts() async {
    setState(() {
      _loadingProduct = true;
      _error = null;
    });
    try {
      final solo = await PlayBillingService.instance.getProductDetails(
        PlayBillingService.instance.proNetworxMonthlyProductId,
      );
      String? bundlePrice;
      try {
        final bundle = await PlayBillingService.instance.getProductDetails(
          PlayBillingService.instance.proBundleMonthlyProductId,
        );
        bundlePrice = bundle.price;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _soloStorePrice = solo.price;
        _bundleStorePrice = bundlePrice;
        if (bundlePrice == null) _plan = _ProPlan.solo;
        _loadingProduct = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingProduct = false;
        _error = PlayBillingService.instance.describeStoreError(
          e,
          productId: PlayBillingService.instance.proNetworxMonthlyProductId,
        );
      });
    }
  }

  Future<void> _subscribeWithStore() async {
    final productId = _activeProductId;
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
      for (final productId in [
        PlayBillingService.instance.proBundleMonthlyProductId,
        PlayBillingService.instance.proNetworxMonthlyProductId,
      ]) {
        final purchase =
            await PlayBillingService.instance.restoreSubscription(productId);
        if (purchase == null) continue;
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
        return;
      }
      throw Exception('No active Pro-Networx or Pro Bundle subscription found.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error =
            'Restore failed: ${PlayBillingService.instance.describeStoreError(e, productId: _activeProductId)}';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _subscribeWithStripe() async {
    final res = _plan == _ProPlan.bundle
        ? await _service.createProBundlePaymentSheet()
        : await _service.createProNetworxPaymentSheet();
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
        merchantDisplayName:
            _plan == _ProPlan.bundle ? 'Pro Bundle' : 'Pro-Networx',
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
        _error = isMobileStorePlatform
            ? PlayBillingService.instance.describeStoreError(
                e,
                productId: _activeProductId,
              )
            : 'Could not start checkout: $e';
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
    final bundleReady = !storeCheckout || _bundleStorePrice != null;
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
            if (bundleReady) ...[
              _PlanTile(
                selected: _plan == _ProPlan.bundle,
                title: 'Pro Bundle',
                subtitle:
                    'Pro-Radio + Pro-Networx — save $proBundleSavingsDisplay vs both alone',
                priceLabel: storeCheckout && _bundleStorePrice != null
                    ? '$_bundleStorePrice/mo'
                    : '$proBundleRegularDisplay/mo',
                badge: 'Best value',
                onTap: () => setState(() => _plan = _ProPlan.bundle),
              ),
              const SizedBox(height: 8),
            ],
            _PlanTile(
              selected: _plan == _ProPlan.solo,
              title: 'Pro-Networx only',
              subtitle:
                  '$proNetworxIntroDisplay first month, then $proNetworxRegularDisplay/mo',
              priceLabel: storeCheckout && _soloStorePrice != null
                  ? '$_soloStorePrice/mo'
                  : '$proNetworxRegularDisplay/mo',
              onTap: () => setState(() => _plan = _ProPlan.solo),
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
                        (storeCheckout &&
                            _plan == _ProPlan.solo &&
                            _soloStorePrice == null) ||
                        (storeCheckout &&
                            _plan == _ProPlan.bundle &&
                            _bundleStorePrice == null))
                    ? null
                    : _subscribe,
                child: (_busy || _loadingProduct)
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        storeCheckout
                            ? 'Subscribe with $mobileStoreLabel'
                            : _plan == _ProPlan.bundle
                                ? 'Get Pro Bundle'
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

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.selected,
    required this.title,
    required this.subtitle,
    required this.priceLabel,
    required this.onTap,
    this.badge,
  });

  final bool selected;
  final String title;
  final String subtitle;
  final String priceLabel;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      color: selected
          ? cs.primary.withValues(alpha: 0.12)
          : cs.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? cs.primary : cs.outlineVariant,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: selected ? cs.primary : cs.onSurfaceVariant,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: cs.primary,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge!,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: cs.onPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: cs.onSurfaceVariant),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                priceLabel,
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
