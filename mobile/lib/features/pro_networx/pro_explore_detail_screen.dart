import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import 'widgets/pro_feed_post_card.dart';

class ProExploreDetailScreen extends StatefulWidget {
  const ProExploreDetailScreen({
    super.key,
    required this.anchorPostId,
    this.authorUserId,
  });
  final String anchorPostId;

  /// When set, the list is only this person's posts. Profile portfolios use
  /// this so opening one tile does not play someone else's feed video.
  final String? authorUserId;

  @override
  State<ProExploreDetailScreen> createState() => _ProExploreDetailScreenState();
}

class _ProExploreDetailScreenState extends State<ProExploreDetailScreen> {
  final ProNetworxService _service = ProNetworxService();
  final ScrollController _controller = ScrollController();
  final List<ProFeedPost> _posts = [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;

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

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final authorId = widget.authorUserId;
      final res = authorId != null && authorId.isNotEmpty
          ? await _service.listUserPosts(authorId, limit: 24)
          : await _service.exploreStream(
              anchorPostId: widget.anchorPostId,
            );
      if (!mounted) return;
      final items = [...res.items];
      final anchor = items.indexWhere((p) => p.id == widget.anchorPostId);
      if (anchor > 0) {
        final tapped = items.removeAt(anchor);
        items.insert(0, tapped);
      }
      setState(() {
        _posts
          ..clear()
          ..addAll(items);
        _nextCursor = res.nextCursor;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final authorId = widget.authorUserId;
      final res = authorId != null && authorId.isNotEmpty
          ? await _service.listUserPosts(
              authorId,
              limit: 24,
              cursor: _nextCursor,
            )
          : await _service.exploreStream(cursor: _nextCursor);
      if (!mounted) return;
      setState(() {
        _posts.addAll(res.items);
        _nextCursor = res.nextCursor;
      });
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
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.authorUserId != null && widget.authorUserId!.isNotEmpty
              ? 'Portfolio'
              : 'Explore',
        ),
      ),
      body: _loading && _posts.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : _posts.isEmpty
              ? const Center(child: Text('Post not found.'))
              : ListView.builder(
                  controller: _controller,
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
                      onChange: (next) =>
                          setState(() => _posts[i] = next),
                      expandedComments: i == 0,
                    );
                  },
                ),
    );
  }
}
