import 'package:flutter/material.dart';

import '../../core/services/users_service.dart';

class BlockedAccountsScreen extends StatefulWidget {
  const BlockedAccountsScreen({super.key});

  @override
  State<BlockedAccountsScreen> createState() => _BlockedAccountsScreenState();
}

class _BlockedAccountsScreenState extends State<BlockedAccountsScreen> {
  final _users = UsersService();
  bool _loading = true;
  String? _error;
  List<BlockedUser> _items = const [];

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
      final items = await _users.listBlockedUsers();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load blocked accounts.';
      });
    }
  }

  Future<void> _unblock(BlockedUser user) async {
    try {
      await _users.unblockUser(user.userId);
      if (!mounted) return;
      setState(() => _items = _items.where((u) => u.userId != user.userId).toList());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Unblocked ${user.label}')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not unblock this account.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Blocked accounts')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      TextButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _items.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'You have not blocked anyone.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        itemCount: _items.length,
                        itemBuilder: (context, i) {
                          final user = _items[i];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundImage: (user.avatarUrl ?? '').isNotEmpty
                                  ? NetworkImage(user.avatarUrl!)
                                  : null,
                              child: (user.avatarUrl ?? '').isEmpty
                                  ? const Icon(Icons.person)
                                  : null,
                            ),
                            title: Text(user.label),
                            subtitle: (user.username ?? '').isNotEmpty
                                ? Text('@${user.username}')
                                : null,
                            trailing: TextButton(
                              onPressed: () => _unblock(user),
                              child: const Text('Unblock'),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
