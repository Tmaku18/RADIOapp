import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/models/follow_models.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/users_service.dart';

/// Send a song clip to friends in NetworX messages.
class SendClipSheet extends StatefulWidget {
  const SendClipSheet({
    super.key,
    required this.file,
    required this.caption,
  });

  final File file;
  final String caption;

  static Future<void> show(
    BuildContext context, {
    required File file,
    required String caption,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => SendClipSheet(file: file, caption: caption),
    );
  }

  @override
  State<SendClipSheet> createState() => _SendClipSheetState();
}

class _SendClipSheetState extends State<SendClipSheet> {
  final UsersService _users = UsersService();
  final MessagesService _messages = MessagesService();
  final Set<String> _selected = <String>{};

  List<FollowListItem> _friends = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      if (me == null) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'Sign in to send this clip.';
          });
        }
        return;
      }
      final friends = await _users.getFriends(me.id);
      if (!mounted) return;
      setState(() {
        _friends = friends;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load your friends.';
      });
    }
  }

  Future<void> _send() async {
    if (_selected.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await _messages.sendVideoToFriends(
        file: widget.file,
        friendIds: _selected.toList(),
        caption: widget.caption,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _selected.length == 1
                ? 'Sent to 1 friend.'
                : 'Sent to ${_selected.length} friends.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = 'Could not send the clip. Try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.7,
      child: Column(
        children: [
          const SizedBox(height: 12),
          Text('Send to friends', style: theme.textTheme.titleMedium),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Text(
              'The song is in the video. Friends get it in their messages.',
              style: theme.textTheme.bodySmall,
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _friends.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'No friends yet. Follow people who follow you back, then send the clip.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      )
                    : ListView(
                        children: [
                          for (final friend in _friends)
                            CheckboxListTile(
                              value: _selected.contains(friend.id),
                              title: Text(
                                (friend.displayName ?? friend.username ?? 'Friend')
                                    .trim(),
                              ),
                              onChanged: _sending
                                  ? null
                                  : (checked) {
                                      setState(() {
                                        if (checked == true) {
                                          _selected.add(friend.id);
                                        } else {
                                          _selected.remove(friend.id);
                                        }
                                      });
                                    },
                            ),
                        ],
                      ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _selected.isEmpty || _sending ? null : _send,
                child: Text(_sending ? 'Sending…' : 'Send'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
