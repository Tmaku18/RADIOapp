import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/auth/auth_service.dart';
import '../../core/models/messages_models.dart';
import '../../core/models/studio_models.dart';
import '../../core/services/messages_service.dart';
import '../../core/services/studio_service.dart';
import '../../core/ui/friendly_error.dart';

Future<void> showShareArtistSheet(
  BuildContext context, {
  required String artistId,
  required String artistName,
  String? shareText,
}) async {
  final name = artistName.trim().isEmpty ? 'This artist' : artistName.trim();
  // /open/artists avoids Universal Link handoff failures in Messages ("Unable
  // to Open Page") while still deep-linking into the installed app from web.
  final id = Uri.encodeComponent(artistId.trim());
  final text = shareText ??
      '$name is on NETWORX Radio.\nhttps://www.networxradio.com/open/artists/$id';
  final action = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.sms_outlined),
              title: const Text('Text'),
              onTap: () => Navigator.pop(context, 'text'),
            ),
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline),
              title: const Text('Send in a DM'),
              onTap: () => Navigator.pop(context, 'dm'),
            ),
          ],
        ),
      );
    },
  );
  if (!context.mounted || action == null) return;
  if (action == 'text') {
    await Share.share(text);
    return;
  }
  final auth = Provider.of<AuthService>(context, listen: false);
  if (auth.currentUser == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Log in to send this profile in a message.')),
    );
    return;
  }
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _DmShareSheet(body: text),
  );
}

class _DmShareSheet extends StatefulWidget {
  const _DmShareSheet({required this.body});

  final String body;

  @override
  State<_DmShareSheet> createState() => _DmShareSheetState();
}

class _DmShareSheetState extends State<_DmShareSheet> {
  final _messages = MessagesService();
  final _studios = StudioService();
  final _query = TextEditingController();
  Timer? _debounce;
  List<ConversationSummary> _conversations = const [];
  List<StudioMember> _hits = const [];
  bool _loading = true;
  String? _sendingId;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final conversations = await _messages.listConversations();
      if (!mounted) return;
      setState(() {
        _conversations = conversations;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  void _onQuery(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      final q = value.trim();
      if (q.length < 2) {
        if (mounted) setState(() => _hits = const []);
        return;
      }
      try {
        final hits = await _studios.searchPeople(q);
        if (!mounted) return;
        setState(() => _hits = hits);
      } catch (_) {
        if (!mounted) return;
        setState(() => _hits = const []);
      }
    });
  }

  Future<void> _send(String userId, String? name) async {
    if (_sendingId != null) return;
    setState(() => _sendingId = userId);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _messages.sendMessage(userId, widget.body);
      if (!mounted) return;
      Navigator.pop(context);
      messenger.showSnackBar(
        SnackBar(content: Text('Sent to ${name?.trim().isNotEmpty == true ? name : 'them'}.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _sendingId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(friendlyError(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim().toLowerCase();
    final recent = _conversations.where((row) {
      if (q.isEmpty) return true;
      return (row.otherDisplayName ?? '').toLowerCase().contains(q);
    });
    final seen = <String>{};
    final people = <({String id, String? name})>[
      for (final hit in _hits)
        if (seen.add(hit.userId)) (id: hit.userId, name: hit.displayName),
      for (final row in recent)
        if (seen.add(row.otherUserId))
          (id: row.otherUserId, name: row.otherDisplayName),
    ];

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          bottom: MediaQuery.viewInsetsOf(context).bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Send profile', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _query,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Search people',
                isDense: true,
                border: OutlineInputBorder(),
              ),
              onChanged: (value) {
                setState(() {});
                _onQuery(value);
              },
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 280,
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : people.isEmpty
                      ? const Align(
                          alignment: Alignment.topLeft,
                          child: Text('Recent messages show up here. Search to find someone else.'),
                        )
                      : ListView.builder(
                          itemCount: people.length,
                          itemBuilder: (context, index) {
                            final person = people[index];
                            final busy = _sendingId == person.id;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(person.name?.trim().isNotEmpty == true
                                  ? person.name!
                                  : 'Member'),
                              trailing: Text(busy ? 'Sending…' : 'Send'),
                              enabled: !busy,
                              onTap: () => _send(person.id, person.name),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
