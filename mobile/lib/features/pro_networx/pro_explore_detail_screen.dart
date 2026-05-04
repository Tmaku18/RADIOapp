import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import 'widgets/pro_feed_post_card.dart';

class ProExploreDetailScreen extends StatefulWidget {
  const ProExploreDetailScreen({super.key, required this.anchorPostId});
  final String anchorPostId;

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
      final res = await _service.exploreStream(
        anchorPostId: widget.anchorPostId,
      );
      if (!mounted) return;
      setState(() {
        _posts
          ..clear()
          ..addAll(res.items);
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
      final res = await _service.exploreStream(cursor: _nextCursor);
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
      appBar: AppBar(title: const Text('Explore')),
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
