import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import 'widgets/pro_feed_post_card.dart';

class ProHomeFeedScreen extends StatefulWidget {
  const ProHomeFeedScreen({super.key});

  @override
  State<ProHomeFeedScreen> createState() => _ProHomeFeedScreenState();
}

class _ProHomeFeedScreenState extends State<ProHomeFeedScreen> {
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
      final res = await _service.listFeed(scope: 'following');
      if (!mounted) return;
      setState(() {
        _posts
          ..clear()
          ..addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load feed.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final res = await _service.listFeed(
        scope: 'following',
        cursor: _nextCursor,
      );
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
              Text(
                'Your home feed is empty',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Follow creators in Search to see their posts here.',
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
