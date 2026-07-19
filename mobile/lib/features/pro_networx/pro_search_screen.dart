import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/pro_networx_service.dart';

class ProSearchScreen extends StatefulWidget {
  const ProSearchScreen({super.key});

  @override
  State<ProSearchScreen> createState() => _ProSearchScreenState();
}

class _ProSearchScreenState extends State<ProSearchScreen> {
  final ProNetworxService _service = ProNetworxService();
  final ScrollController _scroll = ScrollController();
  final TextEditingController _query = TextEditingController();
  Timer? _searchDebounce;

  final List<ProFeedPost> _tiles = [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;

  ProSearchResult? _searchResult;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _loadTiles();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _query.dispose();
    super.dispose();
  }

  Future<void> _loadTiles() async {
    setState(() => _loading = true);
    try {
      final res = await _service.exploreStream();
      if (!mounted) return;
      setState(() {
        _tiles
          ..clear()
          ..addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
      // ignore
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMoreTiles() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final res = await _service.exploreStream(cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        _tiles.addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
      // ignore
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _onScroll() {
    if (_searchResult != null) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 600) {
      _loadMoreTiles();
    }
  }

  void _onQueryChanged(String value) {
    _searchDebounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _searchResult = null;
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    _searchDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final res = await _service.searchFeed(trimmed);
        if (!mounted) return;
        setState(() => _searchResult = res);
      } catch (_) {
        if (!mounted) return;
        setState(
          () => _searchResult = const ProSearchResult(people: [], posts: []),
        );
      } finally {
        if (mounted) setState(() => _searching = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _query,
            onChanged: _onQueryChanged,
            decoration: InputDecoration(
              hintText: 'Search creators, headlines, captions…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _query.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _query.clear();
                        _onQueryChanged('');
                      },
                    )
                  : null,
              border: const OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        Expanded(
          child: _searchResult != null
              ? _buildSearchResults(theme)
              : _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _buildExploreGrid(),
        ),
      ],
    );
  }

  Widget _buildExploreGrid() {
    return CustomScrollView(
      controller: _scroll,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.all(2),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 2,
              crossAxisSpacing: 2,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final post = _tiles[index];
                return InkWell(
                  onTap: () => Navigator.of(context).pushNamed(
                    AppRoutes.proNetworxExploreDetail,
                    arguments: post.id,
                  ),
                  child: post.mediaType == 'video'
                      ? Container(
                          color: Colors.black,
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.play_circle_outline,
                            color: Colors.white70,
                          ),
                        )
                      : CachedNetworkImage(
                          imageUrl: post.imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, _) =>
                              Container(color: Theme.of(context).colorScheme.surfaceContainerHighest),
                          errorWidget: (_, _, _) => Container(
                            color: Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest,
                            alignment: Alignment.center,
                            child: const Icon(Icons.broken_image_outlined),
                          ),
                        ),
                );
              },
              childCount: _tiles.length,
            ),
          ),
        ),
        if (_loadingMore)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
      ],
    );
  }

  Widget _buildSearchResults(ThemeData theme) {
    final result = _searchResult!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 32),
      children: [
        if (_searching)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (result.people.isNotEmpty) ...[
          Text(
            'PEOPLE',
            style: theme.textTheme.labelMedium
                ?.copyWith(letterSpacing: 1.2, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          ...result.people.map(
            (p) => ListTile(
              leading: CircleAvatar(
                backgroundImage: p.avatarUrl != null && p.avatarUrl!.isNotEmpty
                    ? CachedNetworkImageProvider(p.avatarUrl!)
                    : null,
                child: (p.avatarUrl == null || p.avatarUrl!.isEmpty)
                    ? const Icon(Icons.brush)
                    : null,
              ),
              title: Text(p.displayName ?? 'Creator'),
              subtitle: p.headline != null ? Text(p.headline!) : null,
              onTap: () => Navigator.of(context).pushNamed(
                AppRoutes.proProfile,
                arguments: p.userId,
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (result.posts.isNotEmpty) ...[
          Text(
            'POSTS',
            style: theme.textTheme.labelMedium
                ?.copyWith(letterSpacing: 1.2, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: 2,
              crossAxisSpacing: 2,
            ),
            itemCount: result.posts.length,
            itemBuilder: (context, index) {
              final post = result.posts[index];
              return InkWell(
                onTap: () => Navigator.of(context).pushNamed(
                  AppRoutes.proNetworxExploreDetail,
                  arguments: post.id,
                ),
                child: CachedNetworkImage(
                  imageUrl: post.imageUrl,
                  fit: BoxFit.cover,
                ),
              );
            },
          ),
        ],
        if (!_searching &&
            result.people.isEmpty &&
            result.posts.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                'No matches.',
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ),
      ],
    );
  }
}
