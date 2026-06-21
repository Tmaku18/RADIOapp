import 'package:flutter/material.dart';

import '../../core/models/competition_models.dart';

List<LeaderboardSong> mergeVoteCandidates(List<List<LeaderboardSong>> lists) {
  final byId = <String, LeaderboardSong>{};
  for (final list in lists) {
    for (final song in list) {
      if (song.id.isNotEmpty) {
        byId.putIfAbsent(song.id, () => song);
      }
    }
  }
  final merged = byId.values.toList()
    ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
  return merged;
}

/// Select and reorder a ranked Top 7 from leaderboard candidates.
class Top7VotePicker extends StatefulWidget {
  const Top7VotePicker({
    super.key,
    required this.candidates,
    required this.selectedIds,
    required this.onChanged,
  });

  final List<LeaderboardSong> candidates;
  final List<String> selectedIds;
  final ValueChanged<List<String>> onChanged;

  @override
  State<Top7VotePicker> createState() => _Top7VotePickerState();
}

class _Top7VotePickerState extends State<Top7VotePicker> {
  String _query = '';

  Map<String, LeaderboardSong> get _byId => {
    for (final s in widget.candidates) s.id: s,
  };

  List<LeaderboardSong> get _selectedSongs => widget.selectedIds
      .map((id) => _byId[id])
      .whereType<LeaderboardSong>()
      .toList();

  List<LeaderboardSong> get _available {
    final q = _query.trim().toLowerCase();
    return widget.candidates.where((s) {
      if (widget.selectedIds.contains(s.id)) return false;
      if (q.isEmpty) return true;
      return s.title.toLowerCase().contains(q) ||
          s.artistName.toLowerCase().contains(q);
    }).toList();
  }

  void _add(String id) {
    if (widget.selectedIds.contains(id) || widget.selectedIds.length >= 7) {
      return;
    }
    widget.onChanged([...widget.selectedIds, id]);
  }

  void _remove(String id) {
    widget.onChanged(widget.selectedIds.where((x) => x != id).toList());
  }

  void _move(int index, int delta) {
    final next = index + delta;
    if (next < 0 || next >= widget.selectedIds.length) return;
    final copy = List<String>.from(widget.selectedIds);
    final tmp = copy[index];
    copy[index] = copy[next];
    copy[next] = tmp;
    widget.onChanged(copy);
  }

  void _reorder(int oldIndex, int newIndex) {
    if (newIndex > oldIndex) newIndex -= 1;
    final copy = List<String>.from(widget.selectedIds);
    final item = copy.removeAt(oldIndex);
    copy.insert(newIndex, item);
    widget.onChanged(copy);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'Your Top 7 (rank 1 → 7)',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const Spacer(),
            Chip(
              label: Text('${widget.selectedIds.length}/7'),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (_selectedSongs.isEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: scheme.outline.withValues(alpha: 0.35),
              ),
            ),
            child: Text(
              'Add songs below, then drag to set rank order.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          )
        else
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _selectedSongs.length,
            onReorder: _reorder,
            itemBuilder: (context, index) {
              final song = _selectedSongs[index];
              return Material(
                key: ValueKey(song.id),
                color: scheme.surfaceContainerHighest.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(12),
                child: ListTile(
                  leading: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ReorderableDragStartListener(
                        index: index,
                        child: Icon(
                          Icons.drag_handle,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(width: 4),
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: scheme.primary.withValues(alpha: 0.15),
                        child: Text(
                          '${index + 1}',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ),
                    ],
                  ),
                  title: Text(song.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(
                    song.artistName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_up),
                        onPressed: index == 0 ? null : () => _move(index, -1),
                      ),
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_down),
                        onPressed: index == _selectedSongs.length - 1
                            ? null
                            : () => _move(index, 1),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => _remove(song.id),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        const SizedBox(height: 16),
        Text(
          'Add from leaderboard',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        TextField(
          decoration: const InputDecoration(
            hintText: 'Search title or artist…',
            prefixIcon: Icon(Icons.search),
            isDense: true,
          ),
          onChanged: (v) => setState(() => _query = v),
        ),
        const SizedBox(height: 8),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 280),
          child: _available.isEmpty
              ? Align(
                  alignment: Alignment.topLeft,
                  child: Text(
                    widget.candidates.isEmpty
                        ? 'No songs available yet.'
                        : widget.selectedIds.length >= 7
                        ? 'Top 7 full — remove one to swap.'
                        : 'No matches.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                )
              : ListView.separated(
                  itemCount: _available.length,
                  separatorBuilder: (_, index) => const SizedBox(height: 6),
                  itemBuilder: (context, i) {
                    final song = _available[i];
                    return ListTile(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: scheme.outline.withValues(alpha: 0.25),
                        ),
                      ),
                      leading: CircleAvatar(
                        backgroundColor: scheme.primary.withValues(alpha: 0.12),
                        child: const Icon(Icons.music_note, size: 18),
                      ),
                      title: Text(
                        song.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        song.artistName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: FilledButton.tonalIcon(
                        onPressed: widget.selectedIds.length >= 7
                            ? null
                            : () => _add(song.id),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add'),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
