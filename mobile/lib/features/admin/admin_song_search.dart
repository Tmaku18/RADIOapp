import 'package:flutter/material.dart';

class AdminSongChoice {
  const AdminSongChoice({
    required this.id,
    required this.title,
    required this.artist,
  });

  final String id;
  final String title;
  final String artist;
}

/// Type a title or artist and pick from the matches.
class AdminSongSearch extends StatefulWidget {
  const AdminSongSearch({
    super.key,
    required this.songs,
    required this.selectedId,
    required this.onSelect,
    this.enabled = true,
  });

  final List<AdminSongChoice> songs;
  final String? selectedId;
  final ValueChanged<String> onSelect;
  final bool enabled;

  @override
  State<AdminSongSearch> createState() => _AdminSongSearchState();
}

class _AdminSongSearchState extends State<AdminSongSearch> {
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  List<AdminSongChoice> get _matches {
    final needle = _query.text.trim().toLowerCase();
    if (needle.isEmpty) return const [];
    return widget.songs
        .where(
          (song) =>
              song.title.toLowerCase().contains(needle) ||
              song.artist.toLowerCase().contains(needle),
        )
        .take(12)
        .toList();
  }

  void _pick(String id) {
    widget.onSelect(id);
    _query.clear();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final matches = _matches;
    AdminSongChoice? selected;
    for (final song in widget.songs) {
      if (song.id == widget.selectedId) {
        selected = song;
        break;
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _query,
          enabled: widget.enabled,
          decoration: const InputDecoration(
            labelText: 'Search songs',
            hintText: 'Song title or artist',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) {
            if (matches.isNotEmpty) _pick(matches.first.id);
          },
        ),
        const SizedBox(height: 6),
        Text(
          selected == null
              ? 'Type to find a song, then add it next.'
              : 'Selected: ${selected.title} — ${selected.artist}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.65),
          ),
        ),
        if (_query.text.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          if (matches.isEmpty)
            const Text('No songs match.')
          else
            ...matches.map(
              (song) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(
                  song.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  song.artist,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                selected: song.id == widget.selectedId,
                onTap: widget.enabled ? () => _pick(song.id) : null,
              ),
            ),
        ],
      ],
    );
  }
}
