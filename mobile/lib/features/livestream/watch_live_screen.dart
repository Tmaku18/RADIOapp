import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
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

  // Live chat state
  final List<Map<String, dynamic>> _chat = [];
  final Set<String> _seenChatIds = {};
  String? _lastChatTs;
  Timer? _chatPoll;
  final TextEditingController _chatInput = TextEditingController();
  final ScrollController _chatScroll = ScrollController();
  bool _sendingChat = false;

  // Donation state
  static const List<int> _presets = [1, 5, 10, 20, 50];
  int? _presetDollars = 5;
  bool _custom = false;
  final TextEditingController _customAmount = TextEditingController();
  final TextEditingController _message = TextEditingController();
  bool _donating = false;

  bool _isAdmin = false;
  bool _ending = false;

  @override
  void initState() {
    super.initState();
    _load();
    _loadAdmin();
  }

  Future<void> _loadAdmin() async {
    try {
      final profile = await Provider.of<AuthService>(context, listen: false)
          .getUserProfile();
      if (mounted && profile?.role == 'admin') {
        setState(() => _isAdmin = true);
      }
    } catch (_) {
      // Not an admin / not signed in — leave controls hidden.
    }
  }

  Future<void> _endStreamAdmin() async {
    final sessionId = _joinedSessionId ?? _session?['id']?.toString();
    if (sessionId == null || _ending) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End this stream?'),
        content: const Text(
          'The broadcaster will be cut off immediately for everyone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('End stream'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _ending = true);
    try {
      await _live.adminForceStop(sessionId);
      if (!mounted) return;
      setState(() {
        _session = null;
        _error = 'Stream ended by admin.';
      });
    } catch (_) {
      _snack('Could not end the stream');
    } finally {
      if (mounted) setState(() => _ending = false);
    }
  }

  @override
  void dispose() {
    _heartbeat?.cancel();
    _chatPoll?.cancel();
    final sid = _joinedSessionId;
    final vid = _viewerId;
    if (sid != null && vid != null) {
      _live.leave(sid, vid).catchError((_) => null);
    }
    _customAmount.dispose();
    _message.dispose();
    _chatInput.dispose();
    _chatScroll.dispose();
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
          _startChatPolling(sessionId);
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

  void _startChatPolling(String sessionId) {
    _chatPoll?.cancel();
    Future<void> tick() async {
      try {
        final messages =
            await _live.listChat(sessionId, after: _lastChatTs, limit: 50);
        if (messages.isNotEmpty && mounted) {
          _appendChat(messages);
        }
      } catch (_) {
        // Ignore; next poll resyncs.
      }
    }

    tick();
    _chatPoll =
        Timer.periodic(const Duration(seconds: 3), (_) => tick());
  }

  void _appendChat(List<Map<String, dynamic>> incoming) {
    var added = false;
    for (final m in incoming) {
      final id = m['id']?.toString();
      if (id == null || _seenChatIds.contains(id)) continue;
      _seenChatIds.add(id);
      _chat.add(m);
      added = true;
      final ts = m['createdAt']?.toString();
      if (ts != null && ( _lastChatTs == null || ts.compareTo(_lastChatTs!) > 0)) {
        _lastChatTs = ts;
      }
    }
    if (!added) return;
    if (_chat.length > 250) {
      _chat.removeRange(0, _chat.length - 250);
    }
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) {
        _chatScroll.jumpTo(_chatScroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _sendChat() async {
    final sessionId = _joinedSessionId ?? _session?['id']?.toString();
    final text = _chatInput.text.trim();
    if (sessionId == null || text.isEmpty || _sendingChat) return;
    setState(() => _sendingChat = true);
    try {
      final msg = await _live.postChat(sessionId, text);
      if (msg != null) _appendChat([msg]);
      _chatInput.clear();
    } catch (_) {
      _snack('Could not send message');
    } finally {
      if (mounted) setState(() => _sendingChat = false);
    }
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
      appBar: AppBar(
        title: const Text('Watch Live'),
        actions: [
          if (_isAdmin && _session != null)
            TextButton.icon(
              onPressed: _ending ? null : _endStreamAdmin,
              icon: const Icon(Icons.stop_circle_outlined,
                  color: Colors.redAccent),
              label: Text(
                _ending ? 'Ending…' : 'End',
                style: const TextStyle(color: Colors.redAccent),
              ),
            ),
        ],
      ),
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
                      const SizedBox(height: 24),
                      _buildChat(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildChat() {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Live chat', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Container(
          height: 280,
          decoration: BoxDecoration(
            border: Border.all(color: theme.dividerColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: _chat.isEmpty
              ? Center(
                  child: Text(
                    'No messages yet. Say hello! 👋',
                    style: theme.textTheme.bodySmall,
                  ),
                )
              : ListView.builder(
                  controller: _chatScroll,
                  padding: const EdgeInsets.all(8),
                  itemCount: _chat.length,
                  itemBuilder: (context, i) {
                    final m = _chat[i];
                    final name = (m['displayName'] ?? 'Listener').toString();
                    final body = (m['message'] ?? '').toString();
                    final isHost = m['isHost'] == true;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: RichText(
                        text: TextSpan(
                          style: theme.textTheme.bodyMedium,
                          children: [
                            if (isHost)
                              WidgetSpan(
                                alignment: PlaceholderAlignment.middle,
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 4),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: theme.colorScheme.primary
                                          .withValues(alpha: 0.2),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'HOST',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                        color: theme.colorScheme.primary,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            TextSpan(
                              text: '$name: ',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: isHost
                                    ? theme.colorScheme.primary
                                    : _colorForName(name),
                              ),
                            ),
                            TextSpan(text: body),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _chatInput,
                maxLength: 500,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendChat(),
                decoration: const InputDecoration(
                  hintText: 'Send a message',
                  counterText: '',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _sendingChat ? null : _sendChat,
              child: Text(_sendingChat ? '…' : 'Chat'),
            ),
          ],
        ),
      ],
    );
  }

  Color _colorForName(String name) {
    var hash = 0;
    for (final c in name.codeUnits) {
      hash = c + ((hash << 5) - hash);
    }
    final hue = (hash.abs() % 360).toDouble();
    return HSLColor.fromAHSL(1.0, hue, 0.6, 0.6).toColor();
  }
}
