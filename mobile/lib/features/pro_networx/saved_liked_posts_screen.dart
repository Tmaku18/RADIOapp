import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'widgets/pro_feed_post_card.dart';

/// Displays either the current user's bookmarked ("saved") posts or the posts
/// they have liked, selected via [mode].
class SavedLikedPostsScreen extends StatefulWidget {
  const SavedLikedPostsScreen({super.key, required this.mode});

  /// Either `'saved'` or `'liked'`.
  final String mode;

  bool get isLiked => mode == 'liked';

  @override
  State<SavedLikedPostsScreen> createState() => _SavedLikedPostsScreenState();
}

class _SavedLikedPostsScreenState extends State<SavedLikedPostsScreen> {
  final ProNetworxService _service = ProNetworxService();
  final ScrollController _controller = ScrollController();
  final List<ProFeedPost> _posts = [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  Future<({List<ProFeedPost> items, String? nextCursor})> _fetch(
      String? cursor) {
    return widget.isLiked
        ? _service.listLiked(cursor: cursor)
        : _service.listBookmarks(cursor: cursor);
  }

  Future<void> _load({bool refresh = false}) async {
    setState(() {
      if (refresh) {
        _posts.clear();
        _nextCursor = null;
      }
      _loading = true;
      _error = null;
    });
    try {
      final res = await _fetch(null);
      if (!mounted) return;
      setState(() {
        _posts
          ..clear()
          ..addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not load posts.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final res = await _fetch(_nextCursor);
      if (!mounted) return;
      setState(() {
        _posts.addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
      // ignore
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _onScroll() {
    if (_controller.position.pixels >=
        _controller.position.maxScrollExtent - 600) {
      _loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: widget.isLiked ? 'Liked posts' : 'Saved posts',
      showNeonLine: true,
      loading: _loading && _posts.isEmpty && _error == null,
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _posts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _posts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    if (_posts.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                widget.isLiked
                    ? Icons.favorite_border
                    : Icons.bookmark_border,
                size: 40,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              const SizedBox(height: 8),
              Text(
                widget.isLiked
                    ? 'No liked posts yet'
                    : 'No saved posts yet',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                widget.isLiked
                    ? 'Posts you like will appear here.'
                    : 'Tap the bookmark on a post to save it for later.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(refresh: true),
      child: ListView.builder(
        controller: _controller,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _posts.length + (_loadingMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i >= _posts.length) {
            return const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return ProFeedPostCard(
            post: _posts[i],
            onChange: (next) => setState(() => _posts[i] = next),
          );
        },
      ),
    );
  }
}
