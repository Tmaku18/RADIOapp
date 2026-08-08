import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/models/pro_radio_models.dart';
import '../../core/services/pro_radio_queue_service.dart';
import '../../core/services/pro_radio_service.dart';
import 'pro_radio_player_screen.dart';

/// Playlist detail: list tracks, play, and remove songs.
class ProRadioPlaylistScreen extends StatefulWidget {
  const ProRadioPlaylistScreen({super.key, required this.playlist});

  final ProRadioPlaylist playlist;

  @override
  State<ProRadioPlaylistScreen> createState() => _ProRadioPlaylistScreenState();
}

class _ProRadioPlaylistScreenState extends State<ProRadioPlaylistScreen> {
  final ProRadioService _service = ProRadioService();
  final ProRadioQueueService _queue = ProRadioQueueService.instance;

  bool _loading = true;
  String? _error;
  List<ProRadioPlaylistTrack> _tracks = const [];
  String? _busySongId;
  bool _changed = false;

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
      final tracks = await _service.getPlaylistTracks(widget.playlist.id);
      if (!mounted) return;
      setState(() {
        _tracks = tracks;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  List<ProRadioQueueItem> get _playableItems => _tracks
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

  Future<void> _playAll({int startIndex = 0}) async {
    final items = _playableItems;
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This playlist has no playable tracks yet.'),
        ),
      );
      return;
    }
    final safeStart = startIndex.clamp(0, items.length - 1);
    // Open the player first so the listener sees the track and controls while
    // the first buffer loads, the same way tapping a station does.
    _openPlayer();
    try {
      await _queue.playItems(items, startAt: safeStart);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not play: $e')),
      );
    }
  }

  void _openPlayer() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            ProRadioPlayerScreen(playlistTitle: widget.playlist.title),
      ),
    );
  }

  Future<void> _removeTrack(ProRadioPlaylistTrack track) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove song?'),
        content: Text('Remove "${track.title}" from this playlist?'),
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
    if (confirmed != true || !mounted) return;

    setState(() => _busySongId = track.songId);
    try {
      await _service.removeTrack(widget.playlist.id, track.songId);
      if (!mounted) return;
      setState(() {
        _tracks = _tracks.where((t) => t.songId != track.songId).toList();
        _busySongId = null;
        _changed = true;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Removed "${track.title}"')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _busySongId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not remove song: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.playlist.title),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(_changed),
          ),
          actions: [
            IconButton(
              tooltip: 'Play all',
              onPressed: _loading || _tracks.isEmpty ? null : () => _playAll(),
              icon: const Icon(Icons.play_arrow),
            ),
            IconButton(
              tooltip: 'Refresh',
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_error!, textAlign: TextAlign.center),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: _load,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _tracks.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            'No songs in this playlist yet. Add some with the + button on radio, artist pages, Discover, or your library.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(color: cs.onSurfaceVariant),
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          itemCount: _tracks.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (context, i) {
                            final t = _tracks[i];
                            final busy = _busySongId == t.songId;
                            final playable = (t.streamUrl ?? '').isNotEmpty;
                            final art = (t.artworkUrl ?? '').trim();
                            return ListTile(
                              leading: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: SizedBox(
                                  width: 48,
                                  height: 48,
                                  child: art.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: art,
                                          fit: BoxFit.cover,
                                          errorWidget: (_, _, _) => ColoredBox(
                                            color: cs.surfaceContainerHighest,
                                            child: const Icon(Icons.music_note),
                                          ),
                                        )
                                      : ColoredBox(
                                          color: cs.surfaceContainerHighest,
                                          child: const Icon(Icons.music_note),
                                        ),
                                ),
                              ),
                              title: Text(
                                t.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(
                                t.artistName ?? 'Artist',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: playable
                                  ? () {
                                      final playableIndex = _playableItems
                                          .indexWhere(
                                            (item) => item.songId == t.songId,
                                          );
                                      if (playableIndex >= 0) {
                                        _playAll(startIndex: playableIndex);
                                      }
                                    }
                                  : null,
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (playable)
                                    IconButton(
                                      tooltip: 'Play',
                                      onPressed: busy
                                          ? null
                                          : () {
                                              final playableIndex =
                                                  _playableItems.indexWhere(
                                                (item) =>
                                                    item.songId == t.songId,
                                              );
                                              if (playableIndex >= 0) {
                                                _playAll(
                                                  startIndex: playableIndex,
                                                );
                                              }
                                            },
                                      icon: const Icon(Icons.play_arrow),
                                    ),
                                  IconButton(
                                    tooltip: 'Remove from playlist',
                                    onPressed:
                                        busy ? null : () => _removeTrack(t),
                                    icon: busy
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : Icon(
                                            Icons.remove_circle_outline,
                                            color: cs.error,
                                          ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
      ),
    );
  }
}
