import 'package:flutter/material.dart';

import '../../core/services/live_services_service.dart';

/// Live services + Support — parity with web `/artist/live-services`.
class LiveServicesScreen extends StatefulWidget {
  const LiveServicesScreen({super.key});

  @override
  State<LiveServicesScreen> createState() => _LiveServicesScreenState();
}

class _LiveServicesScreenState extends State<LiveServicesScreen>
    with SingleTickerProviderStateMixin {
  final LiveServicesService _svc = LiveServicesService();
  late TabController _tabs;

  bool _loading = true;
  List<LiveServiceItem> _list = const [];
  bool _formOpen = false;
  bool _saving = false;
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _scheduledAt = TextEditingController();
  final _linkOrPlace = TextEditingController();

  final _supportMessage = TextEditingController();
  final _discordLink = TextEditingController();
  bool _supportSaving = false;
  String? _supportNotice;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging && mounted) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _title.dispose();
    _description.dispose();
    _scheduledAt.dispose();
    _linkOrPlace.dispose();
    _supportMessage.dispose();
    _discordLink.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _svc.listMine();
      if (mounted) setState(() => _list = items);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not load live services: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final t = _title.text.trim();
    if (t.isEmpty) return;
    setState(() => _saving = true);
    try {
      await _svc.create(
        title: t,
        description: _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        scheduledAt: _scheduledAt.text.trim().isEmpty
            ? null
            : _scheduledAt.text.trim(),
        linkOrPlace: _linkOrPlace.text.trim().isEmpty
            ? null
            : _linkOrPlace.text.trim(),
      );
      _title.clear();
      _description.clear();
      _scheduledAt.clear();
      _linkOrPlace.clear();
      setState(() => _formOpen = false);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Live service saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove live service?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _svc.delete(id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Remove failed: $e')),
        );
      }
    }
  }

  bool _isDiscordUrl(String raw) {
    try {
      final u = Uri.parse(raw.trim());
      final host = u.host.toLowerCase();
      return host.contains('discord.com') || host.contains('discord.gg');
    } catch (_) {
      return false;
    }
  }

  Future<void> _submitSupport() async {
    final msg = _supportMessage.text.trim();
    final link = _discordLink.text.trim();
    if (msg.isEmpty || link.isEmpty) return;
    if (!_isDiscordUrl(link)) {
      setState(() {
        _supportNotice = 'Please use a Discord link (discord.com or discord.gg).';
      });
      return;
    }
    setState(() {
      _supportSaving = true;
      _supportNotice = null;
    });
    try {
      await _svc.submitSupport(message: msg, discordLink: link);
      _supportMessage.clear();
      _discordLink.clear();
      setState(() {
        _supportNotice = 'Support request sent. We will follow up soon.';
      });
    } catch (e) {
      setState(() {
        _supportNotice = 'Could not send right now. Try again.';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Support failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _supportSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live services'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Services'),
            Tab(text: 'Support'),
          ],
        ),
        actions: [
          if (_tabs.index == 0)
            IconButton(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
        ],
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _buildServicesTab(),
          _buildSupportTab(),
        ],
      ),
    );
  }

  Widget _buildServicesTab() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Promote performances and meetups. Followers see these on your profile.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            FilledButton.icon(
              onPressed: () => setState(() => _formOpen = !_formOpen),
              icon: Icon(_formOpen ? Icons.close : Icons.add),
              label: Text(_formOpen ? 'Cancel' : 'Add live service'),
            ),
          ],
        ),
        if (_formOpen) ...[
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            decoration: const InputDecoration(
              labelText: 'Title',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            decoration: const InputDecoration(
              labelText: 'Description (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _scheduledAt,
            decoration: const InputDecoration(
              labelText: 'Date & time (optional, ISO 8601)',
              hintText: '2026-06-01T20:00:00',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _linkOrPlace,
            decoration: const InputDecoration(
              labelText: 'Link or place (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _saving ? null : _create,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
        const SizedBox(height: 24),
        Text(
          'Your live services',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (_list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'No live services yet.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          )
        else
          ..._list.map(
            (s) => Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(s.title),
                subtitle: s.scheduledAt != null && s.scheduledAt!.isNotEmpty
                    ? Text(s.scheduledAt!)
                    : null,
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () => _remove(s.id),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildSupportTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Tell us what happened in Discord and attach a link to the message or channel so we can help quickly.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _supportMessage,
          decoration: const InputDecoration(
            labelText: 'What happened in Discord?',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
          maxLines: 5,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _discordLink,
          decoration: const InputDecoration(
            labelText: 'Discord link',
            hintText: 'https://discord.com/channels/... or https://discord.gg/...',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.url,
          autocorrect: false,
        ),
        if (_supportNotice != null) ...[
          const SizedBox(height: 12),
          Text(
            _supportNotice!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: _supportSaving ? null : _submitSupport,
          child: _supportSaving
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Send support request'),
        ),
      ],
    );
  }
}
