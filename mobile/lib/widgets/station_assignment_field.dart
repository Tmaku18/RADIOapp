import 'package:flutter/material.dart';

import '../core/data/station_towers.dart';

/// Checkbox multi-select for national stations — mirrors web
/// `StationAssignmentField` (`Stations / Genres`).
class StationAssignmentField extends StatelessWidget {
  const StationAssignmentField({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.maxHeight = 220,
  });

  final List<String> value;
  final ValueChanged<List<String>> onChanged;
  final bool enabled;
  final double maxHeight;

  void _toggle(String stationId) {
    if (!enabled) return;
    final next = List<String>.from(value);
    if (next.contains(stationId)) {
      next.remove(stationId);
    } else {
      next.add(stationId);
    }
    onChanged(next);
  }

  String get _selectedLabel {
    if (value.isEmpty) return 'None selected';
    if (value.length == 1) return '1 station selected';
    return '${value.length} stations selected';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final muted = scheme.onSurface.withValues(alpha: 0.65);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          constraints: BoxConstraints(maxHeight: maxHeight),
          decoration: BoxDecoration(
            border: Border.all(color: scheme.outline.withValues(alpha: 0.45)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: kNationalStationTowers.length,
            separatorBuilder: (_, _) => Divider(
              height: 1,
              color: scheme.outline.withValues(alpha: 0.2),
            ),
            itemBuilder: (context, i) {
              final tower = kNationalStationTowers[i];
              final checked = value.contains(tower.id);
              return CheckboxListTile(
                dense: true,
                value: checked,
                controlAffinity: ListTileControlAffinity.leading,
                title: Text(
                  '${tower.genre} (National)',
                  style: const TextStyle(fontSize: 13),
                ),
                onChanged: enabled ? (_) => _toggle(tower.id) : null,
              );
            },
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '$_selectedLabel. Tap to select one or more stations for this song.',
          style: TextStyle(color: muted, fontSize: 12),
        ),
      ],
    );
  }
}

/// Resolve current station IDs from a song JSON map (snake or camel case).
List<String> stationIdsFromSongMap(Map<String, dynamic> song) {
  final raw = song['station_ids'] ?? song['stationIds'];
  if (raw is List && raw.isNotEmpty) {
    return raw
        .map((e) => e.toString())
        .where((s) => s.isNotEmpty)
        .toList(growable: false);
  }
  final single = (song['station_id'] ?? song['stationId'] ?? '').toString();
  if (single.isEmpty) return const [];
  return [single];
}

/// Human-readable station genre labels for display (e.g. song cards).
String stationLabelsForIds(List<String> ids) {
  if (ids.isEmpty) return '';
  final byId = {for (final t in kNationalStationTowers) t.id: t.genre};
  return ids.map((id) => byId[id] ?? id).join(', ');
}
