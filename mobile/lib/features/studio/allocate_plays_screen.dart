import 'package:flutter/material.dart';
import '../../core/models/song.dart';
import '../../core/services/api_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Standard minute bundles (credits = seconds / 5).
class _Bundle {
  final int credits;
  final String label;
  const _Bundle(this.credits, this.label);
}

const _bundles = [
  _Bundle(12, '1 min'),
  _Bundle(36, '3 min'),
  _Bundle(60, '5 min'),
  _Bundle(120, '10 min'),
  _Bundle(360, '30 min'),
];

class AllocatePlaysScreen extends StatefulWidget {
  final Song song;
  const AllocatePlaysScreen({super.key, required this.song});

  @override
  State<AllocatePlaysScreen> createState() => _AllocatePlaysScreenState();
}

class _AllocatePlaysScreenState extends State<AllocatePlaysScreen> {
  final ApiService _api = ApiService();
  final _customCtrl = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  int _balance = 0;
  int _creditsRemaining = 0;
  int? _selectedBundleIdx;
  String? _error;
  String? _success;
  bool _optInFreePlay = false;

  int get _creditsPerPlay {
    final dur = widget.song.durationSeconds ?? 180;
    return (dur / 5).ceil();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _customCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      final balRes = await _api.get('credits/balance');
      if (balRes is Map<String, dynamic>) {
        _balance = (balRes['balance'] ?? 0) as int;
      }

      final songRes = await _api.get('songs/mine');
      if (songRes is List) {
        final found = songRes.cast<Map<String, dynamic>>().firstWhere(
          (s) => s['id']?.toString() == widget.song.id,
          orElse: () => <String, dynamic>{},
        );
        _creditsRemaining =
            (found['credits_remaining'] ?? found['creditsRemaining'] ?? widget.song.creditsRemaining) as int;
        _optInFreePlay =
            found['optInFreePlay'] == true || found['opt_in_free_play'] == true;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _playsFor(int credits) {
    if (_creditsPerPlay == 0) return 0;
    return credits ~/ _creditsPerPlay;
  }

  int get _allocateAmount {
    if (_selectedBundleIdx != null) {
      return _bundles[_selectedBundleIdx!].credits;
    }
    final custom = int.tryParse(_customCtrl.text) ?? 0;
    return custom > 0 ? custom : 0;
  }

  Future<void> _allocate() async {
    final amount = _allocateAmount;
    if (amount <= 0) {
      setState(() => _error = 'Please select a bundle or enter a valid amount');
      return;
    }
    if (amount > _balance) {
      setState(() => _error = 'Insufficient credits');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      await _api.post('credits/songs/${widget.song.id}/allocate', {'amount': amount});
      _success = 'Successfully allocated $amount credits!';
      _selectedBundleIdx = null;
      _customCtrl.clear();
      await _load();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _withdraw() async {
    if (_creditsRemaining <= 0) return;
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      await _api.post(
        'credits/songs/${widget.song.id}/withdraw',
        {'amount': _creditsRemaining},
      );
      _success = 'Successfully withdrew $_creditsRemaining credits!';
      await _load();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _toggleOptIn() async {
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      await _api.patch(
        'songs/${widget.song.id}/opt-in',
        {'optInFreePlay': !_optInFreePlay},
      );
      setState(() {
        _optInFreePlay = !_optInFreePlay;
        _success = _optInFreePlay ? 'Opted in for free play' : 'Opted out of free play';
      });
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _formatDuration(int? seconds) {
    if (seconds == null) return '--:--';
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Allocate Credits')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Song info card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.song.title,
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontFamily: 'Lora'),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.song.artistName,
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Duration: ${_formatDuration(widget.song.durationSeconds)}'
                          '  •  Credits per play: $_creditsPerPlay',
                          style: TextStyle(
                            color: surfaces.textMuted,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: scheme.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Current Allocation',
                                    style: TextStyle(
                                      color: scheme.primary,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    '$_creditsRemaining credits',
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  Text(
                                    '~${_playsFor(_creditsRemaining)} plays remaining',
                                    style: TextStyle(
                                      color: scheme.primary,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                              if (_creditsRemaining > 0)
                                OutlinedButton(
                                  onPressed: _submitting ? null : _withdraw,
                                  child: const Text('Withdraw All'),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Credit bank card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your Credit Bank',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$_balance credits',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Buy more credits →'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      color: scheme.errorContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _error!,
                          style: TextStyle(color: scheme.onErrorContainer),
                        ),
                      ),
                    ),
                  ),
                if (_success != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      color: scheme.primaryContainer,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _success!,
                          style: TextStyle(color: scheme.onPrimaryContainer),
                        ),
                      ),
                    ),
                  ),

                // Bundle selection
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Select a Bundle',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 12),
                        ...List.generate(_bundles.length, (i) {
                          final b = _bundles[i];
                          final plays = _playsFor(b.credits);
                          final canAfford = b.credits <= _balance;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: InkWell(
                              onTap: canAfford
                                  ? () {
                                      setState(() {
                                        _selectedBundleIdx = i;
                                        _customCtrl.clear();
                                      });
                                    }
                                  : null,
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: _selectedBundleIdx == i
                                        ? scheme.primary
                                        : scheme.outline.withValues(alpha: 0.3),
                                    width: _selectedBundleIdx == i ? 2 : 1,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                  color: !canAfford
                                      ? scheme.surfaceContainerHighest
                                          .withValues(alpha: 0.5)
                                      : _selectedBundleIdx == i
                                          ? scheme.primary.withValues(alpha: 0.08)
                                          : null,
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      _selectedBundleIdx == i
                                          ? Icons.radio_button_checked
                                          : Icons.radio_button_unchecked,
                                      color: _selectedBundleIdx == i
                                          ? scheme.primary
                                          : canAfford
                                              ? scheme.outline
                                              : scheme.outline.withValues(alpha: 0.3),
                                      size: 22,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${b.label} / ~$plays play${plays != 1 ? 's' : ''}',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              color: canAfford
                                                  ? null
                                                  : surfaces.textMuted,
                                            ),
                                          ),
                                          Text(
                                            '${b.credits} credits',
                                            style: TextStyle(
                                              color: surfaces.textMuted,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (!canAfford)
                                      Text(
                                        'Insufficient',
                                        style: TextStyle(
                                          color: scheme.error,
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                        const SizedBox(height: 12),
                        Text(
                          'Or enter custom amount',
                          style: TextStyle(
                            color: surfaces.textSecondary,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _customCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  hintText: 'Enter credits',
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (_) {
                                  setState(() => _selectedBundleIdx = null);
                                },
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'credits',
                              style: TextStyle(color: surfaces.textMuted),
                            ),
                          ],
                        ),
                        if (_customCtrl.text.isNotEmpty &&
                            (int.tryParse(_customCtrl.text) ?? 0) > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '~${_playsFor(int.parse(_customCtrl.text))} plays',
                              style: TextStyle(
                                color: surfaces.textMuted,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed:
                              _submitting || _allocateAmount <= 0 ? null : _allocate,
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Text('Allocate $_allocateAmount Credits'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Free play fallback
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Free Play Fallback',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'When your credits run out, opt-in to keep your song '
                                'in rotation for free.',
                                style: TextStyle(
                                  color: surfaces.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        FilledButton(
                          onPressed: _submitting ? null : _toggleOptIn,
                          style: _optInFreePlay
                              ? null
                              : FilledButton.styleFrom(
                                  backgroundColor: scheme.surfaceContainerHighest,
                                  foregroundColor: scheme.onSurface,
                                ),
                          child: Text(_optInFreePlay ? 'Opted In' : 'Opt In'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}
