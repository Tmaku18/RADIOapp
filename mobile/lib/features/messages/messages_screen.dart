import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/messages_models.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/services/api_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/theme/networx_extensions.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final MessagesService _service = MessagesService();
  bool _loading = true;
  List<ConversationSummary> _conversations = const [];
  app_user.User? _me;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      // Ensure auth token is set before calling messages endpoints.
      final me = await auth.getUserProfile();
      final conv = await _service.listConversations();
      if (!mounted) return;
      setState(() {
        _me = me;
        _conversations = conv;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _conversations.isEmpty
              ? Center(
                  child: Text(
                    'No conversations yet.',
                    style: TextStyle(color: surfaces.textSecondary),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: _conversations.length,
                  separatorBuilder: (_, index) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final c = _conversations[i];
                    return Card(
                      child: ListTile(
                        leading: c.otherAvatarUrl != null
                            ? CircleAvatar(
                                backgroundImage: NetworkImage(c.otherAvatarUrl!),
                              )
                            : const CircleAvatar(child: Text('👤')),
                        title: Text(c.otherDisplayName ?? 'Unknown'),
                        subtitle: Text(
                          (c.lastMessageFromMe ? 'You: ' : '') +
                              (c.lastMessagePreview ?? 'No messages'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                        trailing: Text(
                          _formatTime(c.lastMessageAt),
                          style: TextStyle(color: surfaces.textMuted),
                        ),
                        onTap: _me == null
                            ? null
                            : () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ThreadScreen(
                                      myUserId: _me!.id,
                                      otherUserId: c.otherUserId,
                                      otherDisplayName: c.otherDisplayName,
                                    ),
                                  ),
                                ).then((_) => _load());
                              },
                      ),
                    );
                  },
                ),
    );
  }
}

class ThreadScreen extends StatefulWidget {
  final String myUserId;
  final String otherUserId;
  final String? otherDisplayName;

  const ThreadScreen({
    super.key,
    required this.myUserId,
    required this.otherUserId,
    required this.otherDisplayName,
  });

  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  final MessagesService _service = MessagesService();
  final TextEditingController _draft = TextEditingController();
  final ScrollController _scroll = ScrollController();

  bool _loading = true;
  bool _sending = false;
  bool _paywallShown = false;
  bool? _hasAccess;
  List<MessageRow> _messages = const [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadAccess();
  }

  @override
  void dispose() {
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadAccess() async {
    try {
      final access = await _service.hasCreatorNetworkAccess();
      if (!mounted) return;
      setState(() => _hasAccess = access);
    } catch (_) {
      if (mounted) setState(() => _hasAccess = false);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final msgs = await _service.getThread(widget.otherUserId, limit: 100);
      if (!mounted) return;
      setState(() => _messages = msgs);
      await Future.delayed(const Duration(milliseconds: 50));
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final body = _draft.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _paywallShown = false;
    });
    try {
      await _service.sendMessage(widget.otherUserId, body);
      if (!mounted) return;
      setState(() {
        _draft.text = '';
        _messages = [
          ..._messages,
          MessageRow(
            id: 'temp-${DateTime.now().millisecondsSinceEpoch}',
            senderId: widget.myUserId,
            recipientId: widget.otherUserId,
            body: body,
            createdAt: DateTime.now(),
          ),
        ];
      });
      await Future.delayed(const Duration(milliseconds: 50));
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    } on ApiException catch (e) {
      if (e.statusCode == 403) {
        if (!mounted) return;
        setState(() => _paywallShown = true);
        _loadAccess();
      } else {
        rethrow;
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.otherDisplayName ?? 'Thread'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_paywallShown)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: scheme.secondaryContainer,
                border: Border(
                  bottom: BorderSide(color: surfaces.border),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Creator Network',
                    style: Theme.of(context)
                        .textTheme
                        .titleSmall
                        ?.copyWith(fontFamily: 'Lora'),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _hasAccess == true
                        ? 'Access is active, but this thread is restricted.'
                        : 'Messaging is limited. Upgrade for full access.',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: scheme.onSecondaryContainer),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (context, i) {
                      final m = _messages[i];
                      final isMine = m.senderId == widget.myUserId;
                      return Align(
                        alignment:
                            isMine ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          constraints: const BoxConstraints(maxWidth: 320),
                          decoration: BoxDecoration(
                            color: isMine ? scheme.primary : surfaces.elevated,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            m.body,
                            style: TextStyle(
                              color: isMine ? scheme.onPrimary : scheme.onSurface,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _draft,
                    minLines: 1,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Message',
                      hintText: 'Tap in…',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _sending ? null : _send,
                  child: _sending
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _formatTime(DateTime dt) {
  final now = DateTime.now();
  if (dt.year == now.year && dt.month == now.month && dt.day == now.day) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
  return '${dt.month}/${dt.day}';
}

