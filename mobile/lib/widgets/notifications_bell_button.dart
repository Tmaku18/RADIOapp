import 'package:flutter/material.dart';

import '../core/navigation/app_routes.dart';
import '../core/services/notifications_service.dart';
import '../core/theme/dimension_tokens.dart';

/// App-bar bell that opens Notifications and shows an unread badge.
class NotificationsBellButton extends StatefulWidget {
  const NotificationsBellButton({super.key});

  @override
  State<NotificationsBellButton> createState() =>
      _NotificationsBellButtonState();
}

class _NotificationsBellButtonState extends State<NotificationsBellButton> {
  final NotificationsService _service = NotificationsService();
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    try {
      final count = await _service.getUnreadCount();
      if (!mounted) return;
      setState(() => _unread = count);
    } catch (_) {
      // Best-effort badge.
    }
  }

  Future<void> _open() async {
    await Navigator.pushNamed(context, AppRoutes.notifications);
    if (!mounted) return;
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: _open,
      icon: Badge(
        isLabelVisible: _unread > 0,
        backgroundColor: DimensionTokens.neonCyan,
        textColor: Colors.black,
        label: Text(
          _unread > 99 ? '99+' : '$_unread',
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
        ),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
