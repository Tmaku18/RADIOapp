import 'package:flutter/material.dart';

import '../../core/services/growth_service.dart';
import '../../core/ui/friendly_error.dart';
import '../../widgets/states/app_states.dart';

class NotificationPrefsScreen extends StatefulWidget {
  const NotificationPrefsScreen({super.key});

  @override
  State<NotificationPrefsScreen> createState() => _NotificationPrefsScreenState();
}

class _NotificationPrefsScreenState extends State<NotificationPrefsScreen> {
  final _growth = GrowthService();
  Map<String, dynamic> _prefs = {};
  bool _loading = true;
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
      final prefs = await _growth.notificationPrefs();
      if (mounted) setState(() => _prefs = prefs);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _set(String key, Object? value) async {
    final previous = Map<String, dynamic>.from(_prefs);
    setState(() => _prefs = {..._prefs, key: value});
    try {
      final next = await _growth.updateNotificationPrefs({key: value});
      if (mounted) setState(() => _prefs = next);
    } catch (e) {
      if (!mounted) return;
      setState(() => _prefs = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyError(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: SkeletonList());
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notifications')),
        body: ErrorState(message: _error!, onRetry: _load),
      );
    }
    bool flag(String key) => _prefs[key] != false;
    final start = _prefs['quietHoursStart'];
    final end = _prefs['quietHoursEnd'];
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('New followers'),
            value: flag('newFollower'),
            onChanged: (v) => _set('newFollower', v),
          ),
          SwitchListTile(
            title: const Text('Likes on your posts'),
            value: flag('feedLike'),
            onChanged: (v) => _set('feedLike', v),
          ),
          SwitchListTile(
            title: const Text('Messages'),
            value: flag('messages'),
            onChanged: (v) => _set('messages', v),
          ),
          SwitchListTile(
            title: const Text('Live sessions'),
            value: flag('live'),
            onChanged: (v) => _set('live', v),
          ),
          SwitchListTile(
            title: const Text('Weekly artist recap'),
            subtitle: const Text('A Monday push with your plays from the last 7 days'),
            value: flag('weeklyDigest'),
            onChanged: (v) => _set('weeklyDigest', v),
          ),
          const Divider(),
          ListTile(
            title: const Text('Quiet hours'),
            subtitle: Text(
              start is num && end is num
                  ? 'Muted from ${start.toInt()}:00 to ${end.toInt()}:00 UTC'
                  : 'Off',
            ),
            trailing: start is num
                ? TextButton(
                    onPressed: () => _set('quietHoursStart', null).then((_) {
                      _set('quietHoursEnd', null);
                    }),
                    child: const Text('Clear'),
                  )
                : null,
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Wrap(
              spacing: 8,
              children: [
                for (final window in const [(22, 7), (0, 6), (23, 8)])
                  ChoiceChip(
                    label: Text('${window.$1}:00–${window.$2}:00'),
                    selected: start == window.$1 && end == window.$2,
                    onSelected: (_) async {
                      await _set('quietHoursStart', window.$1);
                      await _set('quietHoursEnd', window.$2);
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
