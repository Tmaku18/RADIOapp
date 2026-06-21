import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/messages_models.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/services/api_service.dart';
import '../../core/services/messages_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';

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
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'No conversations yet.',
                          style: TextStyle(
                            color: surfaces.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Message someone from Discover or an artist profile.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: surfaces.textMuted,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
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
                                Navigator.pushNamed(
                                  context,
                                  AppRoutes.thread,
                                  arguments: {
                                    'myUserId': _me!.id,
                                    'otherUserId': c.otherUserId,
                                    'otherDisplayName': c.otherDisplayName,
                                  },
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

  static const List<String> _reactionEmojis = [
    '👍',
    '❤️',
    '😂',
    '🔥',
    '😮',
    '😢',
  ];

  Future<void> _refreshSilently() async {
    try {
      final msgs = await _service.getThread(widget.otherUserId, limit: 100);
      if (mounted) setState(() => _messages = msgs);
    } catch (_) {
      // keep current state on failure
    }
  }

  void _showMessageActions(MessageRow m) {
    if (m.isUnsent) return;
    final isMine = m.senderId == widget.myUserId;
    final canEdit = isMine && m.messageType == 'text';
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: _reactionEmojis.map((emoji) {
                  return InkWell(
                    onTap: () {
                      Navigator.pop(ctx);
                      _toggleReaction(m, emoji);
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(emoji, style: const TextStyle(fontSize: 24)),
                    ),
                  );
                }).toList(),
              ),
            ),
            const Divider(height: 1),
            if (canEdit)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Edit'),
                onTap: () {
                  Navigator.pop(ctx);
                  _editMessage(m);
                },
              ),
            if (isMine)
              ListTile(
                leading: const Icon(Icons.undo),
                title: const Text('Unsend'),
                onTap: () {
                  Navigator.pop(ctx);
                  _unsendMessage(m);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _toggleReaction(MessageRow m, String emoji) async {
    final mine = m.reactions
        .any((r) => r.userId == widget.myUserId && r.emoji == emoji);
    try {
      if (mine) {
        await _service.removeReaction(messageId: m.id, emoji: emoji);
      } else {
        await _service.addReaction(messageId: m.id, emoji: emoji);
      }
      await _refreshSilently();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update reaction.')),
        );
      }
    }
  }

  Future<void> _editMessage(MessageRow m) async {
    final controller = TextEditingController(text: m.body);
    final newBody = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit message'),
        content: TextField(
          controller: controller,
          autofocus: true,
          minLines: 1,
          maxLines: 5,
          decoration: const InputDecoration(hintText: 'Message'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (newBody == null || newBody.isEmpty || newBody == m.body) return;
    try {
      await _service.editMessage(messageId: m.id, body: newBody);
      await _refreshSilently();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not edit message.')),
        );
      }
    }
  }

  Future<void> _unsendMessage(MessageRow m) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Unsend message?'),
        content: const Text(
          'This removes the message for everyone in the conversation.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Unsend'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _service.unsendMessage(m.id);
      await _refreshSilently();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unsend message.')),
        );
      }
    }
  }

  Widget _buildMessage(
    MessageRow m,
    bool isMine,
    NetworxSurfaces surfaces,
    ColorScheme scheme,
  ) {
    final fg = isMine ? scheme.onPrimary : scheme.onSurface;
    final mutedFg = (isMine ? scheme.onPrimary : scheme.onSurface)
        .withValues(alpha: 0.7);

    Widget content;
    if (m.isUnsent) {
      content = Text(
        'Message removed',
        style: TextStyle(
          color: mutedFg,
          fontStyle: FontStyle.italic,
        ),
      );
    } else {
      final children = <Widget>[];
      if (m.messageType == 'post_share' && m.sharedPost != null) {
        children.add(_buildSharedPost(m.sharedPost!, fg, mutedFg));
      }
      final hasMedia = m.messageType != 'text' &&
          m.messageType != 'post_share' &&
          m.mediaUrl != null &&
          m.mediaUrl!.isNotEmpty;
      if (hasMedia) {
        if (m.messageType == 'image') {
          children.add(
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                m.mediaUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    Icon(Icons.broken_image_outlined, color: mutedFg),
              ),
            ),
          );
        } else {
          children.add(Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                m.messageType == 'video' ? Icons.videocam : Icons.mic,
                size: 18,
                color: fg,
              ),
              const SizedBox(width: 6),
              Text(
                m.messageType == 'video' ? 'Video' : 'Voice message',
                style: TextStyle(color: fg),
              ),
            ],
          ));
        }
      }
      if (m.body.isNotEmpty) {
        if (children.isNotEmpty) children.add(const SizedBox(height: 6));
        children.add(Text(m.body, style: TextStyle(color: fg)));
      }
      if (m.isEdited) {
        children.add(Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            'edited',
            style: TextStyle(color: mutedFg, fontSize: 11),
          ),
        ));
      }
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: children.isEmpty ? [Text('', style: TextStyle(color: fg))] : children,
      );
    }

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(
        crossAxisAlignment:
            isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onLongPress: m.isUnsent ? null : () => _showMessageActions(m),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 4),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              constraints: const BoxConstraints(maxWidth: 320),
              decoration: BoxDecoration(
                color: isMine ? scheme.primary : surfaces.elevated,
                borderRadius: BorderRadius.circular(14),
              ),
              child: content,
            ),
          ),
          if (m.reactions.isNotEmpty)
            _buildReactions(m, surfaces, scheme),
        ],
      ),
    );
  }

  Widget _buildSharedPost(SharedPostSnapshot post, Color fg, Color mutedFg) {
    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed(
        AppRoutes.proNetworxExploreDetail,
        arguments: post.id,
      ),
      child: Container(
        width: 240,
        decoration: BoxDecoration(
          color: fg.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: fg.withValues(alpha: 0.15)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: post.mediaType == 'video'
                  ? Container(
                      color: Colors.black,
                      alignment: Alignment.center,
                      child: const Icon(Icons.play_circle_outline,
                          size: 48, color: Colors.white70),
                    )
                  : Image.network(
                      post.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        color: fg.withValues(alpha: 0.1),
                        alignment: Alignment.center,
                        child: Icon(Icons.broken_image_outlined, color: mutedFg),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    (post.authorUsername != null &&
                            post.authorUsername!.isNotEmpty)
                        ? '@${post.authorUsername}'
                        : (post.authorDisplayName ?? 'Creator'),
                    style: TextStyle(color: fg, fontWeight: FontWeight.w600),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if ((post.caption ?? '').isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      post.caption!,
                      style: TextStyle(color: mutedFg, fontSize: 12),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReactions(
    MessageRow m,
    NetworxSurfaces surfaces,
    ColorScheme scheme,
  ) {
    final counts = <String, int>{};
    final mineEmojis = <String>{};
    for (final r in m.reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.userId == widget.myUserId) mineEmojis.add(r.emoji);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Wrap(
        spacing: 4,
        children: counts.entries.map((e) {
          final mine = mineEmojis.contains(e.key);
          return GestureDetector(
            onTap: () => _toggleReaction(m, e.key),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: mine
                    ? scheme.primary.withValues(alpha: 0.18)
                    : surfaces.elevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: mine ? scheme.primary : surfaces.border,
                ),
              ),
              child: Text(
                '${e.key} ${e.value}',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          );
        }).toList(),
      ),
    );
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
                    style: DimensionTypography.cardTitle(fontSize: 14),
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
                      return _buildMessage(m, isMine, surfaces, scheme);
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

