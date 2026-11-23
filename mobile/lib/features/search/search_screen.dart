import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/radio/station_catalog.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/growth_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/artist_glass_card.dart';
import '../../widgets/shared/media_widgets.dart';
import '../../widgets/states/app_states.dart';
import '../../core/models/discover_audio_models.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _growth = GrowthService();
  final _nearby = NearbyService();
  final _discover = DiscoverAudioService();
  final _query = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<Map<String, dynamic>> _songs = const [];
  List<Map<String, dynamic>> _artists = const [];
  String _artistSort = 'popularity';
  String _artistScope = 'all';
  String? _artistGenre;
  List<DiscoverLikedArtist> _liked = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_search(''));
  }

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
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        q.length < 2
            ? Future<Map<String, dynamic>>.value(const {})
            : _growth.search(q),
        _nearby.listPeople(
          role: 'artist',
          search: q.length < 2 ? null : q,
          sort: _artistSort,
          genre: _artistGenre,
          limit: 50,
        ),
        () async {
          try {
            return await _discover.getLikedArtists(limit: 100);
          } catch (_) {
            return const <DiscoverLikedArtist>[];
          }
        }(),
      ]);
      if (!mounted) return;
      final growth = results[0] as Map<String, dynamic>;
      final people = results[1] as Map<String, dynamic>;
      final liked = results[2] as List<DiscoverLikedArtist>;
      final peopleItems = ((people['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      setState(() {
        _songs = q.length < 2
            ? const []
            : ((growth['songs'] as List?) ?? const [])
                .whereType<Map>()
                .map((e) => Map<String, dynamic>.from(e))
                .toList();
        _artists = peopleItems;
        _liked = liked;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _songs = const [];
        _artists = const [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setSort(String sort) {
    if (_artistSort == sort) return;
    setState(() => _artistSort = sort);
    _search(_query.text);
  }

  void _setGenre(String? genre) {
    if (_artistGenre == genre) return;
    setState(() => _artistGenre = genre);
    _search(_query.text);
  }

  void _setScope(String scope) {
    if (_artistScope == scope) return;
    setState(() => _artistScope = scope);
  }

  int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  List<Map<String, dynamic>> get _visibleArtists {
    final q = _query.text.trim().toLowerCase();
    if (_artistScope == 'liked') {
      return [
        for (final artist in _liked)
          if (q.length < 2 ||
              (artist.displayName ?? '').toLowerCase().contains(q) ||
              (artist.username ?? '').toLowerCase().contains(q))
            {
              'userId': artist.userId,
              'displayName': (artist.displayName ?? '').trim().isEmpty
                  ? 'Artist'
                  : artist.displayName!.trim(),
              'headline': artist.likedSongCount > 0
                  ? '${artist.likedSongCount} liked song${artist.likedSongCount == 1 ? '' : 's'}'
                  : (artist.headline ?? ''),
              'avatarUrl': artist.avatarUrl,
              'likeCount': artist.likedSongCount,
              'listens': 0,
            },
      ];
    }
    if (_artistScope == 'following') {
      return _artists.where((artist) => artist['isFollowing'] == true).toList();
    }
    return _artists;
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final empty = _query.text.trim().length < 2;
    final artists = _visibleArtists;
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
          SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                children: [
                  _FilterChip(
                    label: 'Popular',
                    selected: _artistSort == 'popularity',
                    onTap: () => _setSort('popularity'),
                  ),
                  _FilterChip(
                    label: 'Most songs',
                    selected: _artistSort == 'songs',
                    onTap: () => _setSort('songs'),
                  ),
                  _FilterChip(
                    label: 'Recent',
                    selected: _artistSort == 'recent',
                    onTap: () => _setSort('recent'),
                  ),
                  _FilterChip(
                    label: 'Everyone',
                    selected: _artistScope == 'all',
                    onTap: () => _setScope('all'),
                  ),
                  _FilterChip(
                    label: 'Following',
                    selected: _artistScope == 'following',
                    onTap: () => _setScope('following'),
                  ),
                  _FilterChip(
                    label: 'Liked',
                    selected: _artistScope == 'liked',
                    onTap: () => _setScope('liked'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'All genres',
                    selected: _artistGenre == null,
                    onTap: () => _setGenre(null),
                  ),
                  ...kGenreFilterOptions.map(
                    (g) => _FilterChip(
                      label: g.label,
                      selected: _artistGenre == g.id,
                      onTap: () => _setGenre(g.id),
                    ),
                  ),
                ],
              ),
            ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(
            child: (!empty || artists.isNotEmpty || _loading)
                ? CustomScrollView(
                    slivers: [
                      if (_songs.isEmpty && artists.isEmpty && !_loading)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: EmptyState(
                            title: 'No matches',
                            message: 'Try another name or a shorter word.',
                            illustrationAsset:
                                'assets/images/illustrations/empty-search.jpg',
                          ),
                        ),
                      if (_songs.isNotEmpty) ...[
                        const SliverToBoxAdapter(
                          child: ListTile(title: Text('Songs')),
                        ),
                        SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, i) {
                              final song = _songs[i];
                              return SongTile(
                                title: '${song['title'] ?? ''}',
                                artist: '${song['subtitle'] ?? ''}',
                                artworkUrl: song['imageUrl'] as String?,
                              );
                            },
                            childCount: _songs.length,
                          ),
                        ),
                      ],
                      if (artists.isNotEmpty) ...[
                        const SliverToBoxAdapter(
                          child: Padding(
                            padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
                            child: Text(
                              'Artists',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          sliver: SliverGrid(
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 12,
                              childAspectRatio: 0.68,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, i) {
                                final artist = artists[i];
                                final name = (artist['displayName'] ??
                                        artist['title'] ??
                                        'Artist')
                                    .toString();
                                return ArtistGlassCard(
                                  rank: i + 1,
                                  name: name,
                                  subtitle:
                                      (artist['headline'] ?? '').toString(),
                                  imageUrl: (artist['avatarUrl'] ??
                                          artist['imageUrl'])
                                      ?.toString(),
                                  listens: _asInt(
                                    artist['listens'] ?? artist['earsReached'],
                                  ),
                                  likes: _asInt(artist['likeCount']),
                                  onTap: () {
                                    final id = (artist['userId'] ??
                                            artist['id'])
                                        ?.toString();
                                    if (id == null || id.isEmpty) return;
                                    Navigator.pushNamed(
                                      context,
                                      AppRoutes.artistProfile,
                                      arguments: id,
                                    );
                                  },
                                );
                              },
                              childCount: artists.length,
                            ),
                          ),
                        ),
                      ],
                    ],
                  )
                : const EmptyState(
                    title: 'Search the station',
                    message: 'Find a song, an artist, or someone to follow.',
                    illustrationAsset:
                        'assets/images/illustrations/empty-search.jpg',
                  ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        selectedColor: scheme.primary.withValues(alpha: 0.22),
        checkmarkColor: scheme.primary,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
