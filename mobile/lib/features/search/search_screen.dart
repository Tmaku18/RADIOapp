import 'dart:async';
import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/radio/station_catalog.dart';
import '../../core/services/growth_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/shared/media_widgets.dart';
import '../../widgets/states/app_states.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _growth = GrowthService();
  final _nearby = NearbyService();
  final _query = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<Map<String, dynamic>> _songs = const [];
  List<Map<String, dynamic>> _artists = const [];
  String _artistSort = 'popularity';
  String? _artistGenre;

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
        _artists = const [];
      });
      return;
    }
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _growth.search(q),
        _nearby.listPeople(
          role: 'artist',
          search: q,
          sort: _artistSort,
          genre: _artistGenre,
          limit: 24,
        ),
      ]);
      if (!mounted) return;
      final growth = results[0];
      final people = results[1];
      final peopleItems = ((people['items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      setState(() {
        _songs = ((growth['songs'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _artists = peopleItems;
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

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
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
          if (!empty)
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
            child: empty
                ? const EmptyState(
                    title: 'Search the station',
                    message: 'Find a song, an artist, or someone to follow.',
                    illustrationAsset:
                        'assets/images/illustrations/empty-search.jpg',
                  )
                : CustomScrollView(
                    slivers: [
                      if (_songs.isEmpty && _artists.isEmpty && !_loading)
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
                      if (_artists.isNotEmpty) ...[
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
                              childAspectRatio: 0.72,
                            ),
                            delegate: SliverChildBuilderDelegate(
                              (context, i) {
                                final artist = _artists[i];
                                return _ArtistGlassCard(
                                  index: i,
                                  artist: artist,
                                  onTap: () {
                                    final id =
                                        (artist['userId'] ?? artist['id'])
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
                              childCount: _artists.length,
                            ),
                          ),
                        ),
                      ],
                    ],
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

class _ArtistGlassCard extends StatelessWidget {
  const _ArtistGlassCard({
    required this.index,
    required this.artist,
    required this.onTap,
  });

  final int index;
  final Map<String, dynamic> artist;
  final VoidCallback onTap;

  int _int(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  String _format(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return '$n';
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final name =
        (artist['displayName'] ?? artist['title'] ?? 'Artist').toString();
    final avatar =
        (artist['avatarUrl'] ?? artist['imageUrl'])?.toString();
    final headline = (artist['headline'] ?? '').toString();
    final likes = _int(artist['likeCount']);
    final songs = _int(artist['songCount']);
    final listens = _int(artist['listens'] ?? artist['earsReached']);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (avatar != null && avatar.isNotEmpty)
                CachedNetworkImage(
                  imageUrl: avatar,
                  fit: BoxFit.cover,
                )
              else
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        DimensionTokens.neonCyan.withValues(alpha: 0.25),
                        Colors.black,
                        DimensionTokens.neonPink.withValues(alpha: 0.2),
                      ],
                    ),
                  ),
                  child: Center(
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'A',
                      style: TextStyle(
                        fontSize: 72,
                        fontWeight: FontWeight.w900,
                        color: Colors.white.withValues(alpha: 0.12),
                      ),
                    ),
                  ),
                ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black54,
                      Colors.black87,
                    ],
                    stops: [0.35, 0.7, 1],
                  ),
                ),
              ),
              BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 0.2, sigmaY: 0.2),
                child: const SizedBox.expand(),
              ),
              Positioned(
                top: 10,
                left: 12,
                child: Text(
                  '#${(index + 1).toString().padLeft(2, '0')} / GEM',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.6,
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        height: 1.1,
                      ),
                    ),
                    if (headline.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        headline,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.65),
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      '${_format(listens)} listens · ${_format(likes)} likes · ${_format(songs)} songs',
                      style: TextStyle(
                        color: DimensionTokens.neonCyan.withValues(alpha: 0.9),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
