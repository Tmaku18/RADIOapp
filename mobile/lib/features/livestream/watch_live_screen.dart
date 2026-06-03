import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import 'package:url_launcher/url_launcher.dart';
import '../../core/services/livestream_service.dart';

class WatchLiveScreen extends StatefulWidget {
  final String artistId;
  const WatchLiveScreen({super.key, required this.artistId});

  @override
  State<WatchLiveScreen> createState() => _WatchLiveScreenState();
}

class _WatchLiveScreenState extends State<WatchLiveScreen> {
  final LivestreamService _live = LivestreamService();
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _session;
  int _viewers = 0;

  String? _viewerId;
  String? _joinedSessionId;
  Timer? _heartbeat;

  // Donation state
  static const List<int> _presets = [1, 5, 10, 20, 50];
  int? _presetDollars = 5;
  bool _custom = false;
  final TextEditingController _customAmount = TextEditingController();
  final TextEditingController _message = TextEditingController();
  bool _donating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _heartbeat?.cancel();
    final sid = _joinedSessionId;
    final vid = _viewerId;
    if (sid != null && vid != null) {
      _live.leave(sid, vid).catchError((_) => null);
    }
    _customAmount.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _live.getWatch(widget.artistId);
      final session = data?['session'] is Map<String, dynamic>
          ? data!['session'] as Map<String, dynamic>
          : null;
      if (session != null && session['id'] is String) {
        final sessionId = session['id'] as String;
        final v = session['current_viewers'];
        if (v is int) _viewers = v;
        if (_joinedSessionId != sessionId) {
          _joinedSessionId = sessionId;
          final res =
              await _live.join(sessionId, source: 'mobile_watch_screen');
          _viewerId = res?['viewerId']?.toString();
          final cur = res?['viewers']?['current'];
          if (cur is int) _viewers = cur;
          _startHeartbeat(sessionId);
        }
      }
      if (!mounted) return;
      setState(() {
        _session = session;
        if (session == null) _error = 'Artist is not live right now.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Failed to load stream: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startHeartbeat(String sessionId) {
    _heartbeat?.cancel();
    _heartbeat = Timer.periodic(const Duration(seconds: 15), (_) async {
      final vid = _viewerId;
      if (vid == null) return;
      try {
        final res = await _live.heartbeat(sessionId, vid);
        final v = res?['viewers'];
        if (v is int && mounted) setState(() => _viewers = v);
      } catch (_) {
        // Ignore; next beat or reload will resync.
      }
    });
  }

  Future<void> _openPlayback() async {
    final url =
        (_session?['watch_url'] ?? _session?['playback_hls_url'])?.toString();
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  int get _amountCents {
    final dollars = _custom
        ? (double.tryParse(_customAmount.text.trim()) ?? 0)
        : (_presetDollars ?? 0).toDouble();
    return (dollars * 100).round();
  }

  Future<void> _donate() async {
    final sessionId = _session?['id']?.toString();
    if (sessionId == null || sessionId.isEmpty) return;
    final cents = _amountCents;
    if (cents < 100) {
      _snack('Minimum donation is \$1.00');
      return;
    }
    if (cents > 25000) {
      _snack('Maximum donation is \$250.00');
      return;
    }
    setState(() => _donating = true);
    try {
      final res = await _live.createDonationIntent(
        sessionId,
        cents,
        message: _message.text,
      );
      final clientSecret = res?['clientSecret']?.toString();
      if (clientSecret == null || clientSecret.isEmpty) {
        throw Exception('No payment client secret');
      }

      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: 'NETWORX',
          style: ThemeMode.system,
        ),
      );
      await Stripe.instance.presentPaymentSheet();

      if (!mounted) return;
      _message.clear();
      _snack('Thanks for the tip! 🎉');
    } on StripeException catch (e) {
      if (!mounted) return;
      _snack(e.error.localizedMessage ?? 'Payment canceled');
    } catch (e) {
      if (!mounted) return;
      _snack('Donation failed: $e');
    } finally {
      if (mounted) setState(() => _donating = false);
    }
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Watch Live')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        (_session?['title'] ?? 'Live stream').toString(),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text('$_viewers watching now'),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: _openPlayback,
                        icon: const Icon(Icons.play_circle_fill),
                        label: const Text('Open stream'),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Support this stream',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Send a tip — pick an amount or enter your own.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ..._presets.map((amt) {
                            final selected = !_custom && _presetDollars == amt;
                            return ChoiceChip(
                              label: Text('\$$amt'),
                              selected: selected,
                              onSelected: (_) => setState(() {
                                _custom = false;
                                _presetDollars = amt;
                              }),
                            );
                          }),
                          ChoiceChip(
                            label: const Text('Custom'),
                            selected: _custom,
                            onSelected: (_) =>
                                setState(() => _custom = true),
                          ),
                        ],
                      ),
                      if (_custom) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _customAmount,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          decoration: const InputDecoration(
                            labelText: 'Amount (\$)',
                            prefixText: '\$ ',
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                      const SizedBox(height: 12),
                      TextField(
                        controller: _message,
                        maxLength: 140,
                        decoration: const InputDecoration(
                          labelText: 'Message (optional)',
                        ),
                      ),
                      const SizedBox(height: 4),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _donating ? null : _donate,
                          child: Text(
                            _donating
                                ? 'Processing…'
                                : 'Donate \$${(_amountCents / 100).toStringAsFixed(2)}',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
