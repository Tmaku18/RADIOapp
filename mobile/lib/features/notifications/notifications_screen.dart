import 'package:flutter/material.dart';
import '../../core/models/notification_models.dart';
import '../../core/services/notifications_service.dart';
import '../../core/theme/networx_extensions.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationsService _service = NotificationsService();
  bool _loading = true;
  bool _markingAll = false;
  List<AppNotification> _items = const [];
  String? _error;

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
      final items = await _service.getAll(limit: 100);
      if (!mounted) return;
      setState(() => _items = items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAsRead(AppNotification item) async {
    if (item.read) return;
    await _service.markAsRead(item.id);
    if (!mounted) return;
    setState(() {
      _items = _items
          .map((n) => n.id == item.id
              ? AppNotification(
                  id: n.id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  read: true,
                  createdAt: n.createdAt,
                )
              : n)
          .toList();
    });
  }

  Future<void> _markAllAsRead() async {
    if (_markingAll) return;
    setState(() => _markingAll = true);
    try {
      await _service.markAllAsRead();
      if (!mounted) return;
      setState(() {
        _items = _items
            .map((n) => AppNotification(
                  id: n.id,
                  type: n.type,
                  title: n.title,
                  message: n.message,
                  read: true,
                  createdAt: n.createdAt,
                ))
            .toList();
      });
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  String _friendlyDate(DateTime? dt) {
    if (dt == null) return '';
    final local = dt.toLocal();
    final now = DateTime.now();
    final diff = now.difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${local.month}/${local.day}/${local.year}';
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'song_approved':
        return Icons.check_circle_outline;
      case 'song_rejected':
        return Icons.cancel_outlined;
      case 'song_liked':
        return Icons.favorite_outline;
      case 'song_played':
        return Icons.music_note_outlined;
      default:
        return Icons.notifications_none;
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: (_items.isEmpty || _markingAll) ? null : _markAllAsRead,
            child: _markingAll
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Mark all read'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: [
                        const SizedBox(height: 120),
                        Center(
                          child: Text(
                            _error ?? 'No notifications yet.',
                            style: TextStyle(color: surfaces.textSecondary),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: _items.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final n = _items[i];
                        return Card(
                          color: n.read
                              ? null
                              : Theme.of(context)
                                  .colorScheme
                                  .primaryContainer
                                  .withValues(alpha: 0.25),
                          child: ListTile(
                            onTap: () => _markAsRead(n),
                            leading: Icon(
                              _iconForType(n.type),
                              color: n.type == 'song_liked'
                                  ? Theme.of(context).colorScheme.primary
                                  : surfaces.textSecondary,
                            ),
                            title: Text(
                              n.title,
                              style: TextStyle(
                                fontWeight:
                                    n.read ? FontWeight.w500 : FontWeight.w700,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if ((n.message ?? '').isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(n.message!),
                                  ),
                                const SizedBox(height: 4),
                                Text(
                                  _friendlyDate(n.createdAt),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: surfaces.textMuted,
                                  ),
                                ),
                              ],
                            ),
                            trailing: n.read
                                ? null
                                : const Icon(Icons.mark_email_read_outlined),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
