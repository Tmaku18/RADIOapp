import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/models/pro_radio_models.dart';
import '../../core/services/pro_radio_service.dart';
import '../player/radio_capture_screen.dart';

/// Pick any Pro-Radio song and any moment in it, then record a clip.
///
/// This uses the full track. It is not the Discover clip, the 30-second
/// sample, or whatever is live on the station.
class ProRadioVideoScreen extends StatefulWidget {
  const ProRadioVideoScreen({super.key, this.initial});

  final ProRadioPlaylistTrack? initial;

  @override
  State<ProRadioVideoScreen> createState() => _ProRadioVideoScreenState();
}

class _ProRadioVideoScreenState extends State<ProRadioVideoScreen> {
  final ProRadioService _service = ProRadioService();
  final TextEditingController _search = TextEditingController();
  final AudioPlayer _preview = AudioPlayer();

  Timer? _debounce;
  List<ProRadioPlaylistTrack> _songs = const [];
  ProRadioPlaylistTrack? _selected;
  double _startSec = 0;
  bool _searching = true;
  bool _previewing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial != null && (initial.streamUrl ?? '').trim().isNotEmpty) {
      _selected = initial;
    }
    unawaited(_runSearch(''));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    unawaited(_preview.dispose());
    super.dispose();
  }

  Future<void> _runSearch(String query) async {
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final songs = await _service.searchCatalog(query);
      if (!mounted) return;
      setState(() {
        _songs = songs;
        _searching = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _searching = false;
        _error = 'Could not load Pro-Radio songs.';
      });
    }
  }

  void _onQuery(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      unawaited(_runSearch(value));
    });
  }

  void _choose(ProRadioPlaylistTrack song) {
    if ((song.streamUrl ?? '').trim().isEmpty) return;
    unawaited(_preview.stop());
    setState(() {
      _selected = song;
      _startSec = 0;
      _previewing = false;
    });
  }

  int get _spanSec {
    final duration = _selected?.durationSeconds ?? 0;
    if (duration > 1) return duration - 1;
    return 240;
  }

  String _clock(int seconds) {
    final safe = seconds < 0 ? 0 : seconds;
    final m = safe ~/ 60;
    final s = safe % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _togglePreview() async {
    final song = _selected;
    final url = song?.streamUrl?.trim() ?? '';
    if (song == null || url.isEmpty) return;
    if (_previewing) {
      await _preview.pause();
      if (mounted) setState(() => _previewing = false);
      return;
    }
    try {
      await _preview.setUrl(url);
      await _preview.seek(Duration(milliseconds: (_startSec * 1000).round()));
      await _preview.play();
      if (mounted) setState(() => _previewing = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not preview that part of the song.');
    }
  }

  Future<void> _record() async {
    final song = _selected;
    final url = song?.streamUrl?.trim() ?? '';
    if (song == null || url.isEmpty) return;
    try {
      await _preview.stop();
    } catch (_) {}
    if (mounted) setState(() => _previewing = false);
    if (!mounted) return;
    await Navigator.push<void>(
      context,
      MaterialPageRoute(
        builder: (_) => RadioCaptureScreen(
          audioUrl: url,
          title: song.title,
          artistName: song.artistName ?? '',
          artistId: song.artistId,
          songId: song.songId,
          durationMs: song.durationSeconds > 0 ? song.durationSeconds * 1000 : null,
          startMs: (_startSec * 1000).round(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final song = _selected;
    return Scaffold(
      appBar: AppBar(title: const Text('Record a song')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Choose any Pro-Radio song and the moment the clip should start. '
            'This is the full track, not a Discover clip or the live station.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _search,
            onChanged: _onQuery,
            decoration: const InputDecoration(
              hintText: 'Search songs or artists',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          if (_searching)
            const LinearProgressIndicator()
          else if (_songs.isEmpty)
            const Text('No Pro-Radio songs matched.')
          else
            ..._songs.map((item) {
              final selected = item.songId == song?.songId;
              return ListTile(
                selected: selected,
                contentPadding: EdgeInsets.zero,
                title: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  item.artistName ?? 'Artist',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: selected ? const Icon(Icons.check) : null,
                onTap: () => _choose(item),
              );
            }),
          if (song != null) ...[
            const Divider(height: 32),
            Text(
              song.artistName == null || song.artistName!.trim().isEmpty
                  ? song.title
                  : '${song.title} — ${song.artistName}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text('Start at ${_clock(_startSec.round())} · 15 seconds of the song'),
            Slider(
              value: _startSec.clamp(0, _spanSec.toDouble()),
              max: _spanSec.toDouble(),
              onChanged: (value) {
                setState(() => _startSec = value);
                if (_previewing) {
                  unawaited(
                    _preview.seek(Duration(milliseconds: (value * 1000).round())),
                  );
                }
              },
            ),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _togglePreview,
                  icon: Icon(_previewing ? Icons.pause : Icons.play_arrow),
                  label: Text(_previewing ? 'Pause preview' : 'Preview'),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: _record,
                  icon: const Icon(Icons.videocam_outlined),
                  label: const Text('Record'),
                ),
              ],
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
    );
  }
}
