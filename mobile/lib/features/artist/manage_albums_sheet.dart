import 'package:flutter/material.dart';

import '../../core/models/song.dart';
import '../../core/services/albums_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Owner-only sheet to create albums and assign tracks for the artist page.
Future<bool?> showManageAlbumsSheet(
  BuildContext context, {
  required List<Song> songs,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => ManageAlbumsSheet(songs: songs),
  );
}

class ManageAlbumsSheet extends StatefulWidget {
  const ManageAlbumsSheet({super.key, required this.songs});

  final List<Song> songs;

  @override
  State<ManageAlbumsSheet> createState() => _ManageAlbumsSheetState();
}

class _ManageAlbumsSheetState extends State<ManageAlbumsSheet> {
  final AlbumsService _albums = AlbumsService();
  final TextEditingController _titleCtrl = TextEditingController();

  List<ArtistAlbum> _list = const [];
  bool _loading = true;
  String? _error;
  String _releaseType = 'album';
  String? _editingId;
  List<String> _selectedIds = [];
  bool _saving = false;
  bool _changed = false;

  List<Song> get _songOptions =>
      widget.songs.where((s) => !s.isBeat).toList(growable: false);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final albums = await _albums.listMine();
      if (!mounted) return;
      setState(() {
        _list = albums;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _create() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      final album = await _albums.create(
        title: title,
        releaseType: _releaseType,
      );
      if (!mounted) return;
      _titleCtrl.clear();
      setState(() {
        _list = [album, ..._list];
        _editingId = album.id;
        _selectedIds = [];
        _changed = true;
        _saving = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  void _startEdit(ArtistAlbum album) {
    final ids = _songOptions
        .where((s) => s.albumId == album.id)
        .map((s) => s.id)
        .toList();
    setState(() {
      _editingId = album.id;
      _selectedIds = ids;
    });
  }

  Future<void> _saveTracks() async {
    final id = _editingId;
    if (id == null || _saving) return;
    setState(() => _saving = true);
    try {
      await _albums.setTracks(id, _selectedIds);
      if (!mounted) return;
      setState(() {
        _editingId = null;
        _changed = true;
        _saving = false;
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _saving = false;
      });
    }
  }

  Future<void> _delete(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete album?'),
        content: const Text(
          'Songs stay uploaded — they become singles again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _albums.remove(id);
      if (!mounted) return;
      setState(() {
        _list = _list.where((a) => a.id != id).toList();
        if (_editingId == id) _editingId = null;
        _changed = true;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) {
          return Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: surfaces.textSecondary.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Manage albums',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context, _changed),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _titleCtrl,
                        decoration: const InputDecoration(
                          hintText: 'New album title',
                          isDense: true,
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    DropdownButton<String>(
                      value: _releaseType,
                      items: const [
                        DropdownMenuItem(value: 'album', child: Text('Album')),
                        DropdownMenuItem(value: 'ep', child: Text('EP')),
                        DropdownMenuItem(
                          value: 'mixtape',
                          child: Text('Mixtape'),
                        ),
                        DropdownMenuItem(
                          value: 'single',
                          child: Text('Single'),
                        ),
                      ],
                      onChanged: (v) {
                        if (v != null) setState(() => _releaseType = v);
                      },
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: _saving ? null : _create,
                      child: const Text('Create'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator())
                    : ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        children: [
                          if (_list.isEmpty)
                            Text(
                              'No albums yet. Create one, then assign tracks.',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                          ..._list.map((album) {
                            final editing = _editingId == album.id;
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                album.title,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                              Text(
                                                '${album.releaseType} · ${album.trackCount} tracks',
                                                style: TextStyle(
                                                  color: surfaces.textSecondary,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        TextButton(
                                          onPressed: () => _startEdit(album),
                                          child: const Text('Tracks'),
                                        ),
                                        IconButton(
                                          onPressed: () => _delete(album.id),
                                          icon: const Icon(Icons.delete_outline),
                                        ),
                                      ],
                                    ),
                                    if (editing) ...[
                                      const Divider(),
                                      ..._songOptions.map((song) {
                                        final checked =
                                            _selectedIds.contains(song.id);
                                        final order = checked
                                            ? _selectedIds.indexOf(song.id) + 1
                                            : null;
                                        return CheckboxListTile(
                                          dense: true,
                                          contentPadding: EdgeInsets.zero,
                                          value: checked,
                                          secondary: Text(
                                            order?.toString() ?? '—',
                                            style: TextStyle(
                                              color: surfaces.textSecondary,
                                            ),
                                          ),
                                          title: Text(song.title),
                                          onChanged: (v) {
                                            setState(() {
                                              if (v == true) {
                                                _selectedIds = [
                                                  ..._selectedIds,
                                                  song.id,
                                                ];
                                              } else {
                                                _selectedIds = _selectedIds
                                                    .where((id) => id != song.id)
                                                    .toList();
                                              }
                                            });
                                          },
                                        );
                                      }),
                                      const SizedBox(height: 8),
                                      Row(
                                        children: [
                                          FilledButton(
                                            onPressed:
                                                _saving ? null : _saveTracks,
                                            child: Text(
                                              _saving ? 'Saving…' : 'Save',
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          TextButton(
                                            onPressed: () => setState(
                                              () => _editingId = null,
                                            ),
                                            child: const Text('Cancel'),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
