import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/navigation/home_tab_intent.dart';
import '../../core/services/pro_networx_service.dart';
import '../pro_networx/pro_create_post_screen.dart';
import '../pro_networx/pro_networx_shell_screen.dart';
import '../pro_networx/widgets/feed_post_video.dart';
import '../pro_networx/widgets/pro_feed_reel_item.dart';

/// Networks Radio "Social"/Feed tab — public Discover + Pro-Networx posts, shown
/// as full-screen reels: one post per screen, swipe up for the next.
///
/// Posts come from Pro-Networx create-post and Discover create-video. Listeners
/// and artists can like/comment here; create via Post or Discover create video.
class SocialFeedScreen extends StatefulWidget {
  const SocialFeedScreen({
    super.key,
    this.onOpenNavDrawer,
    this.embeddedInProShell = false,
    this.isActive = true,
  });

  /// Opens the app's left navigation drawer (shown as a hamburger in the bar).
  final VoidCallback? onOpenNavDrawer;

  /// When true, render as a Pro-Networx Discover tab body (no nested AppBar).
  final bool embeddedInProShell;

  /// False when this feed is kept alive under another tab. Clips pause so
  /// they don't keep playing over the radio.
  final bool isActive;

  @override
  State<SocialFeedScreen> createState() => _SocialFeedScreenState();
}

class _SocialFeedScreenState extends State<SocialFeedScreen> {
  final ProNetworxService _service = ProNetworxService();
  final PageController _pageController = PageController();
  int _page = 0;
  final List<ProFeedPost> _posts = [];
  String? _nextCursor;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    SocialFeedRefresh.tick.addListener(_onExternalRefresh);
    _load();
  }

  @override
  void dispose() {
    SocialFeedRefresh.tick.removeListener(_onExternalRefresh);
    _pageController.dispose();
    super.dispose();
  }

  void _onExternalRefresh() {
    if (mounted) _load(refresh: true);
  }

  Future<void> _load({bool refresh = false}) async {
    setState(() {
      if (refresh) {
        _posts.clear();
        _nextCursor = null;
        _page = 0;
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
        _page = 0;
      });
      if (_pageController.hasClients) _pageController.jumpToPage(0);
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
      final res = await _service.listFeed(scope: 'all', cursor: _nextCursor);
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

  void _onPageChanged(int index) {
    setState(() => _page = index);
    // Fetch the next batch while the viewer is still a few reels away.
    if (index >= _posts.length - 3) _loadMore();
  }

  Future<void> _openProNetworxToPost() async {
    if (widget.embeddedInProShell) {
      await Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => const ProCreatePostScreen()));
      if (mounted) await _load(refresh: true);
      return;
    }
    Navigator.of(context).pushNamed(
      AppRoutes.proNetworxShell,
      arguments: ProNetworxShellScreen.tabDiscover,
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = Stack(
      fit: StackFit.expand,
      children: [
        _buildBody(),
        Positioned(
          top: 10,
          right: 10,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.embeddedInProShell)
                IconButton.filledTonal(
                  tooltip: 'Refresh',
                  icon: const Icon(Icons.refresh, size: 20),
                  onPressed: _loading ? null : () => _load(refresh: true),
                ),
              const SizedBox(width: 6),
              FilledButton.icon(
                onPressed: _openProNetworxToPost,
                icon: const Icon(Icons.add_a_photo_outlined, size: 18),
                label: const Text('Post'),
              ),
            ],
          ),
        ),
        if (_loadingMore)
          const Positioned(
            top: 16,
            left: 0,
            right: 0,
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
      ],
    );

    if (widget.embeddedInProShell) {
      return FeedMediaPlayback(active: widget.isActive, child: body);
    }

    return FeedMediaPlayback(
      active: widget.isActive,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: widget.onOpenNavDrawer != null
              ? IconButton(
                  icon: const Icon(Icons.menu),
                  tooltip: 'Menu',
                  onPressed: widget.onOpenNavDrawer,
                )
              : null,
          title: const Text('Social'),
          actions: [
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
              onPressed: _loading ? null : () => _load(refresh: true),
            ),
          ],
        ),
        body: body,
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
    return PageView.builder(
      controller: _pageController,
      scrollDirection: Axis.vertical,
      // Build the neighbouring reels so the next clip is already loaded.
      allowImplicitScrolling: true,
      itemCount: _posts.length,
      onPageChanged: _onPageChanged,
      itemBuilder: (_, i) {
        final post = _posts[i];
        return ProFeedReelItem(
          key: ValueKey(post.id),
          post: post,
          active: i == _page && widget.isActive,
          onChange: (next) {
            final at = _posts.indexWhere((p) => p.id == next.id);
            if (at >= 0) setState(() => _posts[at] = next);
          },
          onDeleted: () => setState(() {
            _posts.removeWhere((p) => p.id == post.id);
            if (_page >= _posts.length) {
              _page = _posts.isEmpty ? 0 : _posts.length - 1;
            }
          }),
        );
      },
    );
  }
}
