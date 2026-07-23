import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import 'package:url_launcher/url_launcher.dart';
import '../../core/models/song.dart';
import '../../core/services/payments_service.dart';
import '../../core/services/play_billing_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../core/theme/networx_tokens.dart';
import '../../core/utils/mobile_store.dart';

/// Response from GET /payments/song-play-price
class SongPlayPrice {
  final String songId;
  final String title;
  final int durationSeconds;
  final int exposuresPerPlacement;
  final String pricePerPlacementDollars;
  final List<PriceOption> options;

  SongPlayPrice({
    required this.songId,
    required this.title,
    required this.durationSeconds,
    required this.exposuresPerPlacement,
    required this.pricePerPlacementDollars,
    required this.options,
  });

  factory SongPlayPrice.fromJson(Map<String, dynamic> json) {
    final optionsList = json['options'] as List<dynamic>? ?? [];
    return SongPlayPrice(
      songId: json['songId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      exposuresPerPlacement:
          (json['exposuresPerPlacement'] as num?)?.toInt() ?? 1000,
      pricePerPlacementDollars:
          json['pricePerPlacementDollars'] as String? ??
          json['pricePerPlayDollars'] as String? ??
          '0.00',
      options: optionsList
          .map((e) => PriceOption.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class PriceOption {
  /// Number of discovery placements (kept as `plays` on the wire for
  /// client/IAP compatibility).
  final int plays;
  final int exposures;
  final int totalCents;
  final String totalDollars;

  PriceOption({
    required this.plays,
    required this.exposures,
    required this.totalCents,
    required this.totalDollars,
  });

  factory PriceOption.fromJson(Map<String, dynamic> json) {
    final placements = (json['plays'] as num?)?.toInt() ?? 0;
    return PriceOption(
      plays: placements,
      exposures: (json['exposures'] as num?)?.toInt() ?? placements * 1000,
      totalCents: (json['totalCents'] as num?)?.toInt() ?? 0,
      totalDollars: json['totalDollars'] as String? ?? '0.00',
    );
  }
}

class BuyPlaysScreen extends StatefulWidget {
  final Song song;

  const BuyPlaysScreen({super.key, required this.song});

  @override
  State<BuyPlaysScreen> createState() => _BuyPlaysScreenState();
}

class _BuyPlaysScreenState extends State<BuyPlaysScreen> {
  final PaymentsService _payments = PaymentsService();

  bool _loading = true;
  bool _submitting = false;
  String? _error;
  SongPlayPrice? _price;
  int? _selectedPlays;

  @override
  void initState() {
    super.initState();
    _loadPrice();
  }

  Future<void> _loadPrice() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _payments.getSongPlayPrice(widget.song.id);
      if (!mounted) return;
      setState(() {
        _price = SongPlayPrice.fromJson(data);
        _loading = false;
        _selectedPlays = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  /// Formats an integer with thousands separators (e.g. 1000 -> "1,000").
  String _withCommas(int n) {
    final digits = n.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  Future<void> _purchase() async {
    if (_selectedPlays == null || _price == null || _submitting) return;
    PriceOption? option;
    for (final o in _price!.options) {
      if (o.plays == _selectedPlays) {
        option = o;
        break;
      }
    }
    if (option == null) return;

    setState(() => _submitting = true);
    try {
      if (isMobileStorePlatform) {
        final totalCents = option.totalCents;
        final productId = PlayBillingService.instance.songPlaysProductIdForPricing(
          plays: _selectedPlays!,
          totalCents: totalCents,
        );
        if (productId == null || productId.isEmpty) {
          throw Exception(
            'No $mobileStoreLabel product mapping found for $_selectedPlays '
            'placement(s) at \$${option.totalDollars} '
            '(key: ${_selectedPlays!}:$totalCents). '
            'Checkout on this device uses $mobileStoreLabel only.',
          );
        }
        final purchase =
            await PlayBillingService.instance.buyConsumable(productId);
        if (Platform.isIOS) {
          await _payments.completeAppStorePurchase(
            productId: purchase.productId,
            signedTransaction: purchase.purchaseToken,
            transactionId: purchase.transactionId,
            songId: widget.song.id,
          );
        } else {
          await _payments.completeGooglePlayPurchase(
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            songId: widget.song.id,
          );
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Purchased $_selectedPlays placement(s) for this song!',
            ),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
        return;
      }

      final response = await _payments.createIntentSongPlays(
        songId: widget.song.id,
        plays: _selectedPlays!,
      );
      final clientSecret = response['clientSecret'] as String?;
      if (clientSecret == null || clientSecret.isEmpty) {
        throw Exception('No payment client secret');
      }

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'Radio App',
          style: ThemeMode.system,
          appearance: const PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: NetworxTokens.butterflyElectric,
            ),
          ),
        ),
      );

      await Stripe.instance.presentPaymentSheet();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Purchased $_selectedPlays placement(s) for this song!',
          ),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context, true);
    } on StripeException catch (e) {
      if (!mounted) return;
      final msg = e.error.localizedMessage ?? 'Payment was cancelled';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg), backgroundColor: Colors.orange),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _checkoutFallback() async {
    if (_selectedPlays == null || _submitting) return;
    setState(() => _submitting = true);
    try {
      final res = await _payments.createCheckoutSessionSongPlays(
        songId: widget.song.id,
        plays: _selectedPlays!,
      );
      final url = res['url']?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('No checkout URL returned by backend.');
      }
      final uri = Uri.tryParse(url);
      if (uri == null) throw Exception('Invalid checkout URL.');
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open checkout: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Buy placements'),
        automaticallyImplyLeading: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _price == null
              ? Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error!,
                        style: TextStyle(color: surfaces.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Back'),
                      ),
                    ],
                  ),
                )
              : _price == null
                  ? const Center(child: Text('No price data'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _price!.title,
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatDuration(_price!.durationSeconds),
                            style: TextStyle(color: surfaces.textSecondary),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Price per placement',
                            style: TextStyle(
                              color: surfaces.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            '\$${_price!.pricePerPlacementDollars} / placement',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Each placement targets ~${_withCommas(_price!.exposuresPerPlacement)} verified listener exposures.',
                            style: TextStyle(
                              color: surfaces.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            Platform.isAndroid
                                ? 'Checkout on this device: Google Play in-app purchase.'
                                : Platform.isIOS
                                    ? 'Checkout on this device: Apple In-App Purchase.'
                                    : 'Checkout on this device: Stripe Checkout.',
                            style: TextStyle(
                              color: surfaces.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Choose number of placements',
                            style: TextStyle(
                              color: surfaces.textMuted,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _price!.options.map((option) {
                              final placements = option.plays;
                              final selected = _selectedPlays == placements;
                              return InkWell(
                                onTap: _submitting
                                    ? null
                                    : () {
                                        setState(
                                          () => _selectedPlays = placements,
                                        );
                                      },
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    color: selected
                                        ? scheme.primary.withValues(alpha: 0.12)
                                        : surfaces.elevated.withValues(alpha: 0.6),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: selected
                                          ? scheme.primary
                                          : Colors.transparent,
                                      width: 2,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        '$placements ${placements == 1 ? "placement" : "placements"}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: scheme.onSurface,
                                        ),
                                      ),
                                      Text(
                                        '~${_withCommas(option.exposures)} exposures',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: surfaces.textMuted,
                                        ),
                                      ),
                                      Text(
                                        '\$${option.totalDollars}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: surfaces.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                          if (_selectedPlays != null) ...[
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _submitting ? null : _purchase,
                                child: _submitting
                                    ? const SizedBox(
                                        height: 20,
                                        width: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : const Text('Continue to payment'),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: _submitting ? null : _checkoutFallback,
                                child: const Text('Open web checkout instead'),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
    );
  }
}
