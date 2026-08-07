import 'package:flutter/material.dart';

import '../../../core/models/pro_radio_models.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/pro_radio_service.dart';
import 'pro_radio_paywall_sheet.dart';

/// Pick (or create) a Pro-Radio playlist and add [songId] to it.
///
/// Used from radio, artist profiles, Discover, and Library via the shared
/// [AddToPlaylistButton] / [AddToPlaylistSheet.show].
class AddToPlaylistSheet extends StatefulWidget {
  const AddToPlaylistSheet({
    super.key,
    required this.songId,
    this.songTitle,
  });

  final String songId;
  final String? songTitle;

  /// Returns `true` when the song was added to a playlist.
  static Future<bool?> show(
    BuildContext context, {
    required String songId,
    String? songTitle,
  }) {
    final id = songId.trim();
    if (id.isEmpty) return Future.value(false);
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => AddToPlaylistSheet(songId: id, songTitle: songTitle),
    );
  }

  @override
  State<AddToPlaylistSheet> createState() => _AddToPlaylistSheetState();
}

class _AddToPlaylistSheetState extends State<AddToPlaylistSheet> {
  final ProRadioService _service = ProRadioService();
  bool _loading = true;
  bool _busy = false;
  String? _error;
  List<ProRadioPlaylist> _playlists = const [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final access = await _service.getAccess();
      if (!mounted) return;
      if (!access.hasAccess) {
        final subscribed = await ProRadioPaywallSheet.show(
          context,
          title: 'Pro-Radio for playlists',
          description:
              'Personal playlists are part of Pro-Radio. Subscribe to save songs from radio, artist pages, Discover, and your library.',
        );
        if (!mounted) return;
        if (subscribed != true) {
          Navigator.of(context).pop(false);
          return;
        }
      }
      final playlists = await _service.listPlaylists();
      if (!mounted) return;
      setState(() {
        _playlists = playlists;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 403) {
        final subscribed = await ProRadioPaywallSheet.show(context);
        if (!mounted) return;
        if (subscribed == true) {
          await _bootstrap();
          return;
        }
        Navigator.of(context).pop(false);
        return;
      }
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load playlists: $e';
      });
    }
  }

  Future<void> _addTo(ProRadioPlaylist playlist) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _service.addTrack(playlist.id, widget.songId);
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop(true);
      messenger.showSnackBar(
        SnackBar(content: Text('Added to "${playlist.title}"')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Could not add song: $e';
      });
    }
  }

  Future<void> _createAndAdd() async {
    final controller = TextEditingController();
    final title = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New playlist'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            hintText: 'Playlist name',
          ),
          onSubmitted: (v) => Navigator.of(ctx).pop(v.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );
    if (title == null || title.isEmpty || !mounted) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final playlist = await _service.createPlaylist(title);
      await _service.addTrack(playlist.id, widget.songId);
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop(true);
      messenger.showSnackBar(
        SnackBar(content: Text('Added to "$title"')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Could not create playlist: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final title = (widget.songTitle ?? '').trim();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Icons.playlist_add, color: cs.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Add to playlist',
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _busy
                      ? null
                      : () => Navigator.of(context).pop(false),
                ),
              ],
            ),
            if (title.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: cs.error)),
                const SizedBox(height: 12),
              ],
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.45,
                ),
                child: _playlists.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                          'No playlists yet. Create one to save this song.',
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(color: cs.onSurfaceVariant),
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: _playlists.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final p = _playlists[i];
                          return ListTile(
                            leading: const Icon(Icons.queue_music),
                            title: Text(p.title),
                            subtitle: Text(
                              '${p.trackCount} track${p.trackCount == 1 ? '' : 's'}',
                            ),
                            enabled: !_busy,
                            onTap: _busy ? null : () => _addTo(p),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _busy ? null : _createAndAdd,
                icon: const Icon(Icons.add),
                label: const Text('New playlist'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Compact + control used next to favorite / like on song rows and players.
class AddToPlaylistButton extends StatelessWidget {
  const AddToPlaylistButton({
    super.key,
    required this.songId,
    this.songTitle,
    this.color,
    this.visualDensity = VisualDensity.compact,
    this.iconSize,
  });

  final String songId;
  final String? songTitle;
  final Color? color;
  final VisualDensity visualDensity;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final id = songId.trim();
    return IconButton(
      visualDensity: visualDensity,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 36, minHeight: 40),
      tooltip: 'Add to playlist',
      onPressed: id.isEmpty
          ? null
          : () => AddToPlaylistSheet.show(
                context,
                songId: id,
                songTitle: songTitle,
              ),
      icon: Icon(Icons.add_circle_outline, color: color, size: iconSize),
    );
  }
}
