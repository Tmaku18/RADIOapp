import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/services/growth_service.dart';
import '../../widgets/shared/media_widgets.dart';
import '../../widgets/states/app_states.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _growth = GrowthService();
  final _query = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<Map<String, dynamic>> _songs = const [];
  List<Map<String, dynamic>> _people = const [];

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 280), () => _search(value));
  }

  Future<void> _search(String value) async {
    final q = value.trim();
    if (q.length < 2) {
      setState(() {
        _songs = const [];
        _people = const [];
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await _growth.search(q);
      if (!mounted) return;
      setState(() {
        _songs = ((res['songs'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _people = ((res['people'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _songs = const [];
        _people = const [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final empty = _query.text.trim().length < 2;
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _query,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Songs, artists, people',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: _onChanged,
            ),
          ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: empty
                ? const EmptyState(
                    title: 'Search the station',
                    message: 'Find a song, an artist, or someone to follow.',
                    illustrationAsset: 'assets/images/illustrations/empty-search.jpg',
                  )
                : ListView(
                    children: [
                      if (_songs.isEmpty && _people.isEmpty && !_loading)
                        const EmptyState(
                          title: 'No matches',
                          message: 'Try another name or a shorter word.',
                          illustrationAsset:
                              'assets/images/illustrations/empty-search.jpg',
                        ),
                      if (_songs.isNotEmpty)
                        const ListTile(title: Text('Songs')),
                      ..._songs.map(
                        (song) => SongTile(
                          title: '${song['title'] ?? ''}',
                          artist: '${song['subtitle'] ?? ''}',
                          artworkUrl: song['imageUrl'] as String?,
                        ),
                      ),
                      if (_people.isNotEmpty)
                        const ListTile(title: Text('People')),
                      ..._people.map(
                        (person) => ListTile(
                          leading: UserAvatar(
                            imageUrl: person['imageUrl'] as String?,
                            name: '${person['title'] ?? ''}',
                          ),
                          title: Text('${person['title'] ?? ''}'),
                          subtitle: Text('${person['subtitle'] ?? ''}'),
                          onTap: () {
                            final id = person['id']?.toString();
                            if (id == null || id.isEmpty) return;
                            Navigator.pushNamed(
                              context,
                              AppRoutes.artistProfile,
                              arguments: id,
                            );
                          },
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
