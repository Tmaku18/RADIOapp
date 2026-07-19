import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/pro_networx_service.dart';
import '../pro_networx/widgets/pro_feed_post_card.dart';

/// Networks Radio "Social" tab — a read-only reader for the Pro-Networx feed.
///
/// Listeners and artists on Networks Radio see all public Pro-Networx posts
/// (newest first), can like and comment, but cannot create posts here.
/// Posting only happens inside Pro-Networx itself, so this screen surfaces a
/// prominent "Post on Pro-Networx" CTA that pushes users into the Pro-Networx
/// shell.
class SocialFeedScreen extends StatefulWidget {
  const SocialFeedScreen({super.key});

  @override
  State<SocialFeedScreen> createState() => _SocialFeedScreenState();
}

class _SocialFeedScreenState extends State<SocialFeedScreen> {
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
      final res = await _service.listFeed(scope: 'all');
      if (!mounted) return;
      setState(() {
        _posts
          ..clear()
          ..addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
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
        scope: 'all',
        cursor: _nextCursor,
      );
      if (!mounted) return;
      setState(() {
        _posts.addAll(res.items);
        _nextCursor = res.nextCursor;
      });
    } catch (_) {
      // ignore — keep current list visible
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

  void _openProNetworxToPost() {
    Navigator.of(context).pushNamed(
      AppRoutes.proNetworxShell,
      arguments: 0, // initialTab = Home (where post composer lives)
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Social'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : () => _load(refresh: true),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: BoxDecoration(
              color: scheme.primaryContainer.withValues(alpha: 0.35),
              border: Border(
                bottom: BorderSide(color: scheme.outlineVariant),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.workspaces_outlined, color: scheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Posts from Pro-Networx',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Like and comment here. To share your work, post from Pro-Networx.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton.icon(
                  onPressed: _openProNetworxToPost,
                  icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                  label: const Text('Post'),
                ),
              ],
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _posts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _posts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _load(refresh: true),
              child: const Text('Retry'),
            ),
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
                'No posts yet',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                'Be the first to share your work on Pro-Networx.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _openProNetworxToPost,
                icon: const Icon(Icons.add_a_photo_outlined),
                label: const Text('Open Pro-Networx'),
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
