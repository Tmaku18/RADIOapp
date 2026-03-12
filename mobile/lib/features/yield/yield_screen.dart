import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/theme/networx_tokens.dart';

class YieldScreen extends StatefulWidget {
  const YieldScreen({super.key});

  @override
  State<YieldScreen> createState() => _YieldScreenState();
}

class _YieldScreenState extends State<YieldScreen> {
  final RadioService _radioService = RadioService();

  bool _loading = true;
  bool _redeeming = false;
  String? _error;
  String? _success;

  int _balanceCents = 0;
  String _tier = 'none';
  int _oresRefinedCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _formatUsdFromCents(int cents) => '\$${(max(0, cents) / 100).toStringAsFixed(2)}';

  String _safeRequestId() {
    final ms = DateTime.now().millisecondsSinceEpoch;
    final r = Random().nextInt(1 << 32);
    return 'req_${ms}_$r';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });

    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();

      final res = await _radioService.getYield();
      if (!mounted) return;

      setState(() {
        _balanceCents = (res?['balanceCents'] as num?)?.toInt() ??
            (res?['balance_cents'] as num?)?.toInt() ??
            0;
        _tier = (res?['tier'] ?? 'none').toString();
        _oresRefinedCount = (res?['oresRefinedCount'] as num?)?.toInt() ??
            (res?['ores_refined_count'] as num?)?.toInt() ??
            0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load The Yield.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _redeem(int amountCents) async {
    setState(() {
      _redeeming = true;
      _error = null;
      _success = null;
    });

    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();

      final requestId = _safeRequestId();
      final res = await _radioService.redeem(
        amountCents: amountCents,
        type: 'virtual_visa',
        requestId: requestId,
      );

      if (!mounted) return;

      final newBalance = (res?['newBalanceCents'] as num?)?.toInt() ??
          (res?['new_balance_cents'] as num?)?.toInt() ??
          (_balanceCents - amountCents);

      HapticFeedback.mediumImpact();

      setState(() {
        _success = 'Redemption submitted. New balance: ${_formatUsdFromCents(newBalance)}.';
      });

      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Redemption failed.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _redeeming = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final canRedeem5 = _balanceCents >= 500;
    final canRedeem10 = _balanceCents >= 1000;

    final tierLabel = _tier.isEmpty
        ? 'Unranked'
        : _tier == 'none'
            ? 'Unranked'
            : '${_tier[0].toUpperCase()}${_tier.substring(1)}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('The Yield'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Rewards Command Center',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Micro-accrual rewards for verified prospecting.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                    ),
              ),
              const SizedBox(height: 16),
              if (_error != null)
                _Banner(
                  kind: _BannerKind.error,
                  text: _error!,
                ),
              if (_success != null)
                _Banner(
                  kind: _BannerKind.success,
                  text: _success!,
                ),
              Expanded(
                child: ListView(
                  children: [
                    _StatCard(
                      label: 'Balance',
                      value: _loading ? '—' : _formatUsdFromCents(_balanceCents),
                      accent: NetworxTokens.electricCyan,
                    ),
                    const SizedBox(height: 12),
                    _StatCard(
                      label: 'Tier',
                      value: _loading ? '—' : tierLabel,
                      accent: NetworxTokens.radioactiveLime,
                    ),
                    const SizedBox(height: 12),
                    _StatCard(
                      label: 'Ores refined',
                      value: _loading ? '—' : _oresRefinedCount.toString(),
                      accent: NetworxTokens.cloudDancer,
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Redeem Virtual Visa',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: (_loading || _redeeming || !canRedeem5) ? null : () => _redeem(500),
                            child: Text(_redeeming ? 'Redeeming…' : 'Redeem \$5'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: (_loading || _redeeming || !canRedeem10) ? null : () => _redeem(1000),
                            child: Text(_redeeming ? 'Redeeming…' : 'Redeem \$10'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (!_loading && !canRedeem5)
                      Text(
                        'Keep prospecting to reach the \$5 threshold.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65),
                            ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _BannerKind { error, success }

class _Banner extends StatelessWidget {
  const _Banner({required this.kind, required this.text});

  final _BannerKind kind;
  final String text;

  @override
  Widget build(BuildContext context) {
    final Color border = kind == _BannerKind.error ? Colors.redAccent : NetworxTokens.electricCyan;
    final Color bg = border.withValues(alpha: 0.10);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border.withValues(alpha: 0.55)),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final bg = Theme.of(context).colorScheme.surface.withValues(alpha: 0.6);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.10),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: accent,
                ),
          ),
        ],
      ),
    );
  }
}

