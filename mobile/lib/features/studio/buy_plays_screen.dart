import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import '../../core/models/song.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../core/theme/networx_tokens.dart';

/// Response from GET /payments/song-play-price
class SongPlayPrice {
  final String songId;
  final String title;
  final int durationSeconds;
  final int pricePerPlayCents;
  final String pricePerPlayDollars;
  final List<PriceOption> options;

  SongPlayPrice({
    required this.songId,
    required this.title,
    required this.durationSeconds,
    required this.pricePerPlayCents,
    required this.pricePerPlayDollars,
    required this.options,
  });

  factory SongPlayPrice.fromJson(Map<String, dynamic> json) {
    final optionsList = json['options'] as List<dynamic>? ?? [];
    return SongPlayPrice(
      songId: json['songId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      pricePerPlayCents: (json['pricePerPlayCents'] as num?)?.toInt() ?? 0,
      pricePerPlayDollars: json['pricePerPlayDollars'] as String? ?? '0.00',
      options: optionsList
          .map((e) => PriceOption.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class PriceOption {
  final int plays;
  final int totalCents;
  final String totalDollars;

  PriceOption({
    required this.plays,
    required this.totalCents,
    required this.totalDollars,
  });

  factory PriceOption.fromJson(Map<String, dynamic> json) {
    return PriceOption(
      plays: (json['plays'] as num?)?.toInt() ?? 0,
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
  final ApiService _api = ApiService();

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
      final data = await _api.get(
        'payments/song-play-price?songId=${Uri.encodeComponent(widget.song.id)}',
      );
      if (!mounted) return;
      setState(() {
        _price = data is Map<String, dynamic>
            ? SongPlayPrice.fromJson(data)
            : null;
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
      final response = await _api.post('payments/create-intent-song-plays', {
        'songId': widget.song.id,
        'plays': _selectedPlays,
      });
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
          content: Text('Successfully purchased $_selectedPlays plays!'),
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

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Buy plays'),
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
                            'Price per play',
                            style: TextStyle(
                              color: surfaces.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            '\$${_price!.pricePerPlayDollars} / play',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Choose number of plays',
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
                              final plays = option.plays;
                              final selected = _selectedPlays == plays;
                              return InkWell(
                                onTap: _submitting
                                    ? null
                                    : () {
                                        setState(() => _selectedPlays = plays);
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
                                        '$plays ${plays == 1 ? "play" : "plays"}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w600,
                                          color: scheme.onSurface,
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
                          ],
                        ],
                      ),
                    ),
    );
  }
}
