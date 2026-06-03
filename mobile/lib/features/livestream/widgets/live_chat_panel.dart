import 'dart:async';

import 'package:flutter/material.dart';
import '../../../core/services/livestream_service.dart';

/// Self-contained Twitch-style live chat panel for a stream session.
///
/// Polls for new messages every few seconds, lets the signed-in user send
/// messages, and (when [canModerate] is true, e.g. for the broadcasting host)
/// allows long-pressing a message to delete it.
///
/// Designed to be placed inside a bounded box (e.g. an [Expanded]); the message
/// list fills the available height and the input row sits at the bottom.
class LiveChatPanel extends StatefulWidget {
  final String sessionId;

  /// Show host/admin moderation affordances (long-press to delete a message).
  final bool canModerate;

  const LiveChatPanel({
    super.key,
    required this.sessionId,
    this.canModerate = false,
  });

  @override
  State<LiveChatPanel> createState() => _LiveChatPanelState();
}

class _LiveChatPanelState extends State<LiveChatPanel> {
  final LivestreamService _live = LivestreamService();

  final List<Map<String, dynamic>> _chat = [];
  final Set<String> _seenChatIds = {};
  String? _lastChatTs;
  Timer? _chatPoll;
  final TextEditingController _chatInput = TextEditingController();
  final ScrollController _chatScroll = ScrollController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  @override
  void dispose() {
    _chatPoll?.cancel();
    _chatInput.dispose();
    _chatScroll.dispose();
    super.dispose();
  }

  void _startPolling() {
    _chatPoll?.cancel();
    Future<void> tick() async {
      try {
        final messages = await _live.listChat(
          widget.sessionId,
          after: _lastChatTs,
          limit: 50,
        );
        if (messages.isNotEmpty && mounted) {
          _appendChat(messages);
        }
      } catch (_) {
        // Ignore; next poll resyncs.
      }
    }

    tick();
    _chatPoll = Timer.periodic(const Duration(seconds: 3), (_) => tick());
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
      if (ts != null && (_lastChatTs == null || ts.compareTo(_lastChatTs!) > 0)) {
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

  Future<void> _send() async {
    final text = _chatInput.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      final msg = await _live.postChat(widget.sessionId, text);
      if (msg != null) _appendChat([msg]);
      _chatInput.clear();
    } catch (_) {
      _snack('Could not send message');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _delete(String id) async {
    try {
      final ok = await _live.deleteChat(widget.sessionId, id);
      if (ok && mounted) {
        setState(() => _chat.removeWhere((m) => m['id']?.toString() == id));
      }
    } catch (_) {
      _snack('Could not remove message');
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  void _confirmDelete(Map<String, dynamic> m) {
    final id = m['id']?.toString();
    if (id == null) return;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.red),
              title: const Text('Remove this message'),
              subtitle: Text((m['message'] ?? '').toString(),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: () {
                Navigator.pop(ctx);
                _delete(id);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Live chat', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              border: Border.all(color: theme.dividerColor),
              borderRadius: BorderRadius.circular(12),
            ),
            child: _chat.isEmpty
                ? Center(
                    child: Text(
                      'No messages yet.',
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
                      return InkWell(
                        onLongPress:
                            widget.canModerate ? () => _confirmDelete(m) : null,
                        child: Padding(
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
                                          borderRadius:
                                              BorderRadius.circular(4),
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
                        ),
                      );
                    },
                  ),
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
                onSubmitted: (_) => _send(),
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
              onPressed: _sending ? null : _send,
              child: Text(_sending ? '…' : 'Chat'),
            ),
          ],
        ),
        if (widget.canModerate)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Long-press a message to remove it.',
              style: theme.textTheme.bodySmall,
            ),
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
