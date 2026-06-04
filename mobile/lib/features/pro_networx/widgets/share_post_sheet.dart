import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/models/follow_models.dart';
import '../../../core/models/pro_networx_models.dart';
import '../../../core/services/messages_service.dart';
import '../../../core/services/users_service.dart';

/// Bottom sheet that lets the user share a feed [post] into a DM with one or
/// more of their friends (mutual follows).
class SharePostSheet extends StatefulWidget {
  const SharePostSheet({super.key, required this.post});

  final ProFeedPost post;

  static Future<void> show(BuildContext context, ProFeedPost post) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SharePostSheet(post: post),
    );
  }

  @override
  State<SharePostSheet> createState() => _SharePostSheetState();
}

class _SharePostSheetState extends State<SharePostSheet> {
  final UsersService _usersService = UsersService();
  final MessagesService _messagesService = MessagesService();
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();
  final Set<String> _selected = <String>{};

  List<FollowListItem> _friends = const [];
  bool _loading = true;
  bool _sending = false;
  String? _error;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _loadFriends();
    _searchController.addListener(() {
      setState(() => _query = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadFriends() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      if (me == null) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'You need to be signed in to share.';
          });
        }
        return;
      }
      final friends = await _usersService.getFriends(me.id);
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

  List<FollowListItem> get _filtered {
    if (_query.isEmpty) return _friends;
    return _friends.where((f) {
      final name = (f.displayName ?? '').toLowerCase();
      final handle = (f.username ?? '').toLowerCase();
      return name.contains(_query) || handle.contains(_query);
    }).toList();
  }

  Future<void> _send() async {
    if (_selected.isEmpty || _sending) return;
    setState(() => _sending = true);
    final note = _noteController.text.trim();
    var sent = 0;
    for (final id in _selected) {
      try {
        await _messagesService.sharePost(
          id,
          widget.post.id,
          note: note.isEmpty ? null : note,
        );
        sent++;
      } catch (_) {
        // continue with the rest
      }
    }
    if (!mounted) return;
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          sent > 0
              ? 'Shared with $sent ${sent == 1 ? 'friend' : 'friends'}.'
              : 'Could not share the post.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
              child: Row(
                children: [
                  Text('Share with friends',
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search friends',
                  prefixIcon: const Icon(Icons.search),
                  isDense: true,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
            Expanded(child: _buildList(theme, cs)),
            if (_friends.isNotEmpty) ...[
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: TextField(
                  controller: _noteController,
                  decoration: const InputDecoration(
                    hintText: 'Add a message (optional)',
                    isDense: true,
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                    16, 4, 16, 12 + MediaQuery.of(context).padding.bottom),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed:
                        _selected.isEmpty || _sending ? null : _send,
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child:
                                CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_selected.isEmpty
                            ? 'Send'
                            : 'Send to ${_selected.length}'),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildList(ThemeData theme, ColorScheme cs) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }
    final items = _filtered;
    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _friends.isEmpty
                ? 'You have no friends yet. Friends are people you follow who follow you back.'
                : 'No friends match your search.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium
                ?.copyWith(color: cs.onSurfaceVariant),
          ),
        ),
      );
    }
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (_, i) {
        final f = items[i];
        final selected = _selected.contains(f.id);
        return CheckboxListTile(
          value: selected,
          onChanged: (v) {
            setState(() {
              if (v == true) {
                _selected.add(f.id);
              } else {
                _selected.remove(f.id);
              }
            });
          },
          controlAffinity: ListTileControlAffinity.trailing,
          secondary: CircleAvatar(
            radius: 18,
            backgroundColor: cs.surfaceContainerHighest,
            backgroundImage:
                (f.avatarUrl != null && f.avatarUrl!.isNotEmpty)
                    ? CachedNetworkImageProvider(f.avatarUrl!)
                    : null,
            child: (f.avatarUrl == null || f.avatarUrl!.isEmpty)
                ? const Icon(Icons.person, size: 18)
                : null,
          ),
          title: Text(
            f.displayName ?? 'Creator',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: (f.username != null && f.username!.isNotEmpty)
              ? Text('@${f.username}',
                  maxLines: 1, overflow: TextOverflow.ellipsis)
              : null,
        );
      },
    );
  }
}
