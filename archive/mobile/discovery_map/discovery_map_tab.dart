// ARCHIVED 2026-06-13 — Removed from the app along with the Discovery "Map" tab.
// Original location: this was the private `_MapTab` / `_MapTabState` widget
// defined inline inside mobile/lib/features/discovery/discovery_screen.dart.
//
// To restore the tab you can either:
//   (a) paste the `_MapTabState.build` body back into a private `_MapTab`
//       widget inside discovery_screen.dart, or
//   (b) drop this file into mobile/lib/features/discovery/ as a public
//       `DiscoveryMapTab` widget and reference it from the TabBarView.
// Either way, restore discovery_map_models.dart and discovery_map_service.dart
// and re-add the `Tab(text: 'Map')` entry (and bump DefaultTabController
// length back to 5). See README.md.
//
// The imports below assume this file lives at
// mobile/lib/features/discovery/discovery_map_tab.dart.

import 'package:flutter/material.dart';
import '../../core/models/discovery_map_models.dart';
import '../../core/services/discovery_map_service.dart';
import '../../core/theme/networx_extensions.dart';

class DiscoveryMapTab extends StatefulWidget {
  const DiscoveryMapTab({super.key});

  @override
  State<DiscoveryMapTab> createState() => _DiscoveryMapTabState();
}

class _DiscoveryMapTabState extends State<DiscoveryMapTab> {
  final DiscoveryMapService _service = DiscoveryMapService();
  bool _loading = true;
  List<DiscoveryMapHeatBucket> _heat = const [];
  List<DiscoveryMapCluster> _clusters = const [];
  DiscoveryMapCluster? _selectedCluster;
  List<DiscoveryMapArtistMarker> _artists = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final heat = await _service.getHeat(role: 'artist');
      final clusters = await _service.getClusters(role: 'artist');
      if (!mounted) return;
      setState(() {
        _heat = heat;
        _clusters = clusters;
      });
      if (clusters.isNotEmpty) {
        await _selectCluster(clusters.first);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _selectCluster(DiscoveryMapCluster cluster) async {
    setState(() => _selectedCluster = cluster);
    final artists = await _service.getArtists(cluster: cluster, role: 'artist');
    if (!mounted) return;
    setState(() => _artists = artists);
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Area Heat (likes by artist home location)'),
                  const SizedBox(height: 8),
                  if (_heat.isEmpty)
                    Text(
                      'No heat data yet.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _heat.take(12).map((h) {
                        return Chip(
                          label: Text(
                            '${h.totalLikes} likes • ${h.artistCount} artists',
                          ),
                          avatar: const Icon(
                            Icons.local_fire_department,
                            size: 16,
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Clusters'),
                  const SizedBox(height: 8),
                  if (_clusters.isEmpty)
                    Text(
                      'No clusters yet.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _clusters.take(20).map((c) {
                        final selected = _selectedCluster?.id == c.id;
                        return ChoiceChip(
                          selected: selected,
                          onSelected: (_) => _selectCluster(c),
                          label: Text(
                            '${c.artistCount} artists • ${c.totalLikes} likes',
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Artists in selected cluster'),
                  const SizedBox(height: 8),
                  if (_artists.isEmpty)
                    Text(
                      'Pick a cluster to load artists.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    ..._artists
                        .take(25)
                        .map(
                          (artist) => ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(artist.displayName ?? 'Artist'),
                            subtitle: Text(
                              '${artist.locationRegion ?? 'Unknown'} • ${artist.likeCount} likes',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                          ),
                        ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
