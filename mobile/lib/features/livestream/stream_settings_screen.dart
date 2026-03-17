import 'package:flutter/material.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/livestream_service.dart';

/// Stream settings: request streaming access, show pending, or open Go Live.
/// Streaming requires admin approval; artists and Catalysts can apply here.
class StreamSettingsScreen extends StatefulWidget {
  const StreamSettingsScreen({super.key});

  @override
  State<StreamSettingsScreen> createState() => _StreamSettingsScreenState();
}

class _StreamSettingsScreenState extends State<StreamSettingsScreen> {
  final LivestreamService _live = LivestreamService();
  Map<String, dynamic>? _status;
  bool _loading = true;
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final s = await _live.getStreamerStatus();
      if (mounted) {
        setState(() {
          _status = s;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _status = null;
          _loading = false;
        });
      }
    }
  }

  Future<void> _apply() async {
    setState(() => _applying = true);
    try {
      await _live.applyToStream();
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Request submitted. An admin will review it.')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Stream settings')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final canStream = _status?['canStream'] == true;
    final appliedAt = _status?['appliedAt'];
    final approvedAt = _status?['approvedAt'];
    final rejectedAt = _status?['rejectedAt'];
    final role = _status?['role'] as String?;

    final canApply = role == 'artist' || role == 'service_provider';

    if (!canApply) {
      return Scaffold(
        appBar: AppBar(title: const Text('Stream settings')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Only artists and Catalysts (service providers) can request streaming access.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          ),
        ),
      );
    }

    if (!canStream && appliedAt == null && rejectedAt == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Stream settings')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Request access to go live. An admin must approve before you can stream.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _applying ? null : _apply,
                child: Text(_applying ? 'Submitting...' : 'Request streaming access'),
              ),
            ],
          ),
        ),
      );
    }

    if (appliedAt != null && approvedAt == null && rejectedAt == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Stream settings')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Your request is pending. An admin will review it soon. You’ll be able to go live from here once approved.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Applied ${DateTime.tryParse(appliedAt.toString())?.toLocal().toString().split(' ').first ?? ''}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (rejectedAt != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Stream settings')),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Your streaming application was not approved. You can reapply below.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.tonal(
                onPressed: _applying ? null : _apply,
                child: Text(_applying ? 'Submitting...' : 'Reapply for streaming access'),
              ),
            ],
          ),
        ),
      );
    }

    // Approved: open Go Live
    return Scaffold(
      appBar: AppBar(title: const Text('Stream settings')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Manage your livestream. Set title, description, and category, then start or end your stream.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                Navigator.pushNamed(context, AppRoutes.goLive);
              },
              child: const Text('Open Stream Manager (Go Live)'),
            ),
          ],
        ),
      ),
    );
  }
}
