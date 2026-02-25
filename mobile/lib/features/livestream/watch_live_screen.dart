import 'package:flutter/material.dart';
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
  final TextEditingController _amount = TextEditingController(text: '5');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _live.getWatch(widget.artistId);
      final session = data?['session'] is Map<String, dynamic> ? data!['session'] as Map<String, dynamic> : null;
      if (session != null && session['id'] is String) {
        await _live.join(session['id'] as String, source: 'mobile_watch_screen');
      }
      if (!mounted) return;
      setState(() => _session = session);
      if (session == null) setState(() => _error = 'Artist is not live right now.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Failed to load stream: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openPlayback() async {
    final url = (_session?['watch_url'] ?? _session?['playback_hls_url'])?.toString();
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _donate() async {
    final sessionId = _session?['id']?.toString();
    if (sessionId == null || sessionId.isEmpty) return;
    final dollars = double.tryParse(_amount.text.trim()) ?? 0;
    final cents = (dollars * 100).round();
    if (cents < 100) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Minimum donation is \$1.00')));
      return;
    }
    try {
      final res = await _live.createDonationIntent(sessionId, cents);
      final hasClientSecret = (res?['clientSecret']?.toString().isNotEmpty ?? false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(hasClientSecret ? 'Donation intent ready. Complete via Stripe flow.' : 'Donation prepared')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Donation failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Watch Live')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!))
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text((_session?['title'] ?? 'Live Session').toString(), style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 8),
                      Text('Viewers: ${_session?['current_viewers'] ?? 0}'),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: _openPlayback,
                        icon: const Icon(Icons.play_circle_fill),
                        label: const Text('Open stream'),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _amount,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(labelText: 'Donation (\$)'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          FilledButton(
                            onPressed: _donate,
                            child: const Text('Donate'),
                          ),
                        ],
                      ),
                    ],
                  ),
      ),
    );
  }
}

