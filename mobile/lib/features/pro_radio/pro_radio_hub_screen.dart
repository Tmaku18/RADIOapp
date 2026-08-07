import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/constants/pro_radio_pricing.dart';
import '../../core/models/pro_radio_models.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/pro_radio_queue_service.dart';
import '../../core/services/pro_radio_service.dart';
import 'pro_radio_playlist_screen.dart';
import 'widgets/pro_radio_paywall_sheet.dart';

/// Pro-Radio hub: subscribe CTA, playlists, and on-demand player controls.
class ProRadioHubScreen extends StatefulWidget {
  const ProRadioHubScreen({super.key});

  @override
  State<ProRadioHubScreen> createState() => _ProRadioHubScreenState();
}

class _ProRadioHubScreenState extends State<ProRadioHubScreen> {
  final ProRadioService _service = ProRadioService();
  final ProRadioQueueService _queue = ProRadioQueueService.instance;
  final AudioPlayerService _audio = AudioPlayerService();

  bool _loading = true;
  bool? _hasAccess;
  bool _betaFree = false;
  List<ProRadioPlaylist> _playlists = const [];
  String? _error;
  StreamSubscription? _queueSub;
  StreamSubscription? _playerSub;
  bool _playing = false;

  @override
  void initState() {
    super.initState();
    _load();
    _queueSub = _queue.changes.listen((_) {
      if (mounted) setState(() {});
    });
    _playerSub = _audio.player.playingStream.listen((playing) {
      if (mounted) setState(() => _playing = playing);
    });
  }

  @override
  void dispose() {
    _queueSub?.cancel();
    _playerSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final access = await _service.getAccess();
      if (!mounted) return;
      // Access and playlists are independent: a playlist-table outage must not
      // flip a beta (or subscribed) user back onto the paywall.
      setState(() {
        _hasAccess = access.hasAccess;
        _betaFree = access.betaFree;
        _loading = false;
      });
      if (!access.hasAccess) return;

      try {
        final playlists = await _service.listPlaylists();
        if (!mounted) return;
        setState(() {
          _playlists = playlists;
          _error = null;
        });
      } catch (e) {
        if (!mounted) return;
        final raw = e.toString().replaceFirst('Exception: ', '');
        setState(() {
          _playlists = const [];
          _error = raw.contains('user_playlists') || raw.contains('schema cache')
              ? 'Playlists are temporarily unavailable. Pull to refresh — '
                  'listening still works during beta.'
              : raw;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
        _hasAccess = false;
      });
    }
  }

  Future<void> _subscribe() async {
    final ok = await ProRadioPaywallSheet.show(context);
    if (ok == true) await _load();
  }

  Future<void> _createPlaylist() async {
    final controller = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New playlist'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Playlist name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (title == null || title.isEmpty) return;
    try {
      await _service.createPlaylist(title);
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not create playlist: $e')),
      );
    }
  }

  Future<void> _openPlaylist(ProRadioPlaylist playlist) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProRadioPlaylistScreen(playlist: playlist),
      ),
    );
    if (changed == true && mounted) await _load();
  }

  Future<void> _playPlaylist(ProRadioPlaylist playlist) async {
    try {
      final tracks = await _service.getPlaylistTracks(playlist.id);
      final items = tracks
          .where((t) => (t.streamUrl ?? '').isNotEmpty)
          .map(
            (t) => ProRadioQueueItem(
              songId: t.songId,
              title: t.title,
              artistName: t.artistName,
              artworkUrl: t.artworkUrl,
              audioUrl: t.streamUrl!,
            ),
          )
          .toList();
      if (items.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('This playlist has no playable tracks yet.'),
          ),
        );
        return;
      }
      await _queue.playItems(items);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not play playlist: $e')),
      );
    }
  }

  Future<void> _togglePlayPause() async {
    if (_audio.player.playing) {
      await _audio.player.pause();
    } else {
      await _audio.player.play();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final current = _queue.current;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pro-Radio'),
        actions: [
          if (_hasAccess == true)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'New playlist',
              onPressed: _createPlaylist,
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  Text(
                    'On-demand listening',
                    style: theme.textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _hasAccess == true
                        ? (_betaFree
                            ? 'Free during beta — play full tracks, build playlists, and control your queue.'
                            : 'Play full tracks, build playlists, and control your queue.')
                        : 'Subscribe for $proRadioIntroDisplay first month, then $proRadioRegularDisplay/mo.',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: cs.onSurfaceVariant),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: TextStyle(color: cs.error)),
                  ],
                  if (_hasAccess != true) ...[
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _subscribe,
                      child: Text(
                        'Subscribe — $proRadioIntroDisplay first month',
                      ),
                    ),
                  ],
                  if (current != null) ...[
                    const SizedBox(height: 24),
                    Text('Now playing', style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.music_note),
                        title: Text(current.title),
                        subtitle: Text(current.artistName ?? 'Artist'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: _queue.canSkipPrevious
                              ? _queue.skipPrevious
                              : null,
                          icon: const Icon(Icons.skip_previous),
                        ),
                        IconButton(
                          onPressed: _togglePlayPause,
                          icon: Icon(
                            _playing ? Icons.pause_circle : Icons.play_circle,
                            size: 40,
                          ),
                        ),
                        IconButton(
                          onPressed:
                              _queue.canSkipNext ? _queue.skipNext : null,
                          icon: const Icon(Icons.skip_next),
                        ),
                        IconButton(
                          onPressed: () {
                            _queue.toggleShuffle();
                            setState(() {});
                          },
                          icon: Icon(
                            Icons.shuffle,
                            color: _queue.shuffle ? cs.primary : null,
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            _queue.toggleRepeat();
                            setState(() {});
                          },
                          icon: Icon(
                            Icons.repeat,
                            color: _queue.repeat ? cs.primary : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 24),
                  Text('Your playlists', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  if (_hasAccess != true)
                    Text(
                      'Playlists unlock with Pro-Radio.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: cs.onSurfaceVariant),
                    )
                  else if (_playlists.isEmpty)
                    Text(
                      'No playlists yet. Tap + to create one, then add songs with the + button on radio, artist pages, Discover, or your library.',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: cs.onSurfaceVariant),
                    )
                  else
                    ..._playlists.map(
                      (p) => ListTile(
                        leading: const Icon(Icons.queue_music),
                        title: Text(p.title),
                        subtitle: Text(
                          '${p.trackCount} track${p.trackCount == 1 ? '' : 's'} · tap to manage',
                        ),
                        onTap: () => _openPlaylist(p),
                        trailing: IconButton(
                          tooltip: 'Play playlist',
                          icon: const Icon(Icons.play_arrow),
                          onPressed: () => _playPlaylist(p),
                        ),
                      ),
                    ),
                  if (_queue.queue.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Text('Up next', style: theme.textTheme.titleMedium),
                    ..._queue.queue.asMap().entries.map((e) {
                      final i = e.key;
                      final item = e.value;
                      final playing = i == _queue.currentIndex;
                      return ListTile(
                        dense: true,
                        leading: Icon(
                          playing ? Icons.equalizer : Icons.music_note,
                          color: playing ? cs.primary : null,
                        ),
                        title: Text(item.title),
                        subtitle: Text(item.artistName ?? ''),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () {
                            _queue.removeAt(i);
                            setState(() {});
                          },
                        ),
                      );
                    }),
                  ],
                ],
              ),
            ),
    );
  }
}
