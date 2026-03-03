import 'package:flutter/material.dart';
import '../../core/services/livestream_service.dart';

class GoLiveScreen extends StatefulWidget {
  const GoLiveScreen({super.key});

  @override
  State<GoLiveScreen> createState() => _GoLiveScreenState();
}

class _GoLiveScreenState extends State<GoLiveScreen> {
  final LivestreamService _live = LivestreamService();
  final TextEditingController _title = TextEditingController(text: 'Live from NETWORX');
  final TextEditingController _description = TextEditingController();
  final TextEditingController _category = TextEditingController();
  bool _loading = false;
  Map<String, dynamic>? _session;
  Map<String, dynamic>? _ingest;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() => _loading = true);
    try {
      final data = await _live.start(
        title: _title.text.trim().isEmpty ? null : _title.text.trim(),
        description: _description.text.trim().isEmpty ? null : _description.text.trim(),
        category: _category.text.trim().isEmpty ? null : _category.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _session = data?['session'] is Map<String, dynamic> ? data!['session'] as Map<String, dynamic> : null;
        _ingest = data?['ingest'] is Map<String, dynamic> ? data!['ingest'] as Map<String, dynamic> : null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Start failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _stop() async {
    setState(() => _loading = true);
    try {
      await _live.stop();
      if (!mounted) return;
      setState(() {
        _session = null;
        _ingest = null;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Stop failed: $e')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Stream Info')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Stream info',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _title,
            decoration: const InputDecoration(
              labelText: 'Title',
              hintText: 'e.g. Studio session',
              border: OutlineInputBorder(),
            ),
            maxLength: 140,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            decoration: const InputDecoration(
              labelText: 'Description',
              hintText: "What's this stream about?",
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
            maxLength: 1000,
            maxLines: 3,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _category,
            decoration: const InputDecoration(
              labelText: 'Category',
              hintText: 'e.g. Music, Talk',
              border: OutlineInputBorder(),
            ),
            maxLength: 64,
          ),
          const SizedBox(height: 24),
          Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _loading ? null : _start,
                    child: Text(_loading ? 'Starting…' : 'Start live'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _loading ? null : _stop,
                    child: const Text('End live'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          if (_session != null) ...[
            Text('Session: ${_session!['id'] ?? ''}'),
            Text('Status: ${_session!['status'] ?? ''}'),
          ],
          if (_ingest != null) ...[
            const SizedBox(height: 8),
            Text('RTMP URL: ${_ingest!['rtmpUrl'] ?? ''}'),
            Text('Stream key: ${_ingest!['streamKey'] ?? '(hidden after creation)'}'),
          ],
          const SizedBox(height: 12),
          const Text(
            'Use the RTMP URL + stream key in your encoder setup. Native in-app camera broadcaster is planned next.',
          ),
        ],
      ),
    );
  }
}

