import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/models/browse_models.dart';
import '../../core/models/discover_audio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/browse_like_events_service.dart';
import '../../core/services/browse_service.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'discover_audio_tab.dart';

class DiscoveryScreen extends StatefulWidget {
  const DiscoveryScreen({
    super.key,
    this.onOpenNavDrawer,
    this.initialTabIndex = 0,
  });

  /// Opens the app's left navigation drawer (shown as a hamburger in the bar).
  final VoidCallback? onOpenNavDrawer;

  /// 0 Swipe · 1 Saved · 2 Artists · 3 Library (web `/browse/saved` ≈ Library).
  final int initialTabIndex;

  @override
  State<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends State<DiscoveryScreen>
    with SingleTickerProviderStateMixin {
  static const int _pageSize = 12;
  final BrowseService _service = BrowseService();
  final NearbyService _people = NearbyService();
  final BrowseLikeEventsService _likeEvents = BrowseLikeEventsService();
  final ScrollController _scroll = ScrollController();
  final TextEditingController _searchCtrl = TextEditingController();
  final String _seed = DateTime.now().millisecondsSinceEpoch.toString();
  final GlobalKey<DiscoverAudioTabState> _swipeKey =
      GlobalKey<DiscoverAudioTabState>();
  final GlobalKey<_LibraryTabState> _libraryKey = GlobalKey<_LibraryTabState>();
  final GlobalKey<_DiscoverListTabState> _savedKey =
      GlobalKey<_DiscoverListTabState>();
  late final TabController _tabController;
  StreamSubscription<BrowseLikeEvent>? _likeEventsSub;
  Timer? _searchDebounce;

  bool _loading = true;
  bool _loadingMore = false;
  String? _nextCursor;
  String? _loadError;
  List<BrowseFeedItem> _items = <BrowseFeedItem>[];

  String? _likingId;
  String? _bookmarkingId;

  bool _searchingArtists = false;
  String? _artistSearchError;
  List<Map<String, dynamic>> _artistResults = const [];

  bool get _hasArtistQuery => _searchCtrl.text.trim().length >= 2;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 4,
      vsync: this,
      initialIndex: widget.initialTabIndex.clamp(0, 3),
    );
    _searchCtrl.addListener(_onSearchTextChanged);
    _loadPage(append: false);
    _likeEvents.start();
    _likeEventsSub = _likeEvents.stream.listen((event) {
      if (!mounted) return;
      setState(() {
        _items = _items
            .map(
              (item) => item.id == event.contentId
                  ? item.copyWith(likeCount: item.likeCount + 1)
                  : item,
            )
            .toList();
      });
    });
    _scroll.addListener(() {
      if (_nextCursor == null || _loadingMore) return;
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) {
        _loadPage(append: true);
      }
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.removeListener(_onSearchTextChanged);
    _searchCtrl.dispose();
    _likeEventsSub?.cancel();
    _likeEvents.stop();
    _scroll.dispose();
    _tabController.dispose();
    super.dispose();
  }

  void _onSearchTextChanged() {
    _searchDebounce?.cancel();
    final q = _searchCtrl.text.trim();
    if (q.length < 2) {
      setState(() {
        _artistResults = const [];
        _artistSearchError = null;
        _searchingArtists = false;
      });
      return;
    }
    setState(() => _searchingArtists = true);
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      unawaited(_searchArtists(q));
    });
  }

  Future<void> _searchArtists(String query) async {
    final q = query.trim();
    if (q.length < 2) return;
    setState(() {
      _searchingArtists = true;
      _artistSearchError = null;
    });
    try {
      final res = await _people.listPeople(
        role: 'artist',
        search: q,
        limit: 40,
      );
      final raw = (res['items'] is List) ? res['items'] as List : const [];
      final items = raw
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();
      if (!mounted || _searchCtrl.text.trim() != q) return;
      setState(() => _artistResults = items);
    } catch (e) {
      if (!mounted || _searchCtrl.text.trim() != q) return;
      setState(() {
        _artistSearchError = "Couldn't search artists. Try again.";
        _artistResults = const [];
      });
    } finally {
      if (mounted && _searchCtrl.text.trim() == q) {
        setState(() => _searchingArtists = false);
      }
    }
  }

  void _openArtist(Map<String, dynamic> person) {
    final id = (person['userId'] ?? person['user_id'] ?? person['id'] ?? '')
        .toString()
        .trim();
    if (id.isEmpty) return;
    Navigator.pushNamed(
      context,
      AppRoutes.artistProfile,
      arguments: id,
    );
  }

  Future<void> _onAppBarRefresh() async {
    switch (_tabController.index) {
      case 0:
        await _swipeKey.currentState?.reshuffleFeed();
        return;
      case 1:
        await _savedKey.currentState?.reload();
        return;
      case 3:
        await _libraryKey.currentState?.reload();
        return;
      case 2:
      default:
        await _loadPage(append: false);
    }
  }

  Future<void> _loadPage({required bool append}) async {
    if (append) {
      setState(() => _loadingMore = true);
    } else {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }

    try {
      final page = await _service.getFeed(
        limit: _pageSize,
        cursor: append ? _nextCursor : null,
        seed: _seed,
      );
      if (!mounted) return;
      setState(() {
        _items = append ? [..._items, ...page.items] : page.items;
        _nextCursor = page.nextCursor;
        _loadError = null;
      });
    } catch (_) {
      // The feed can transiently fail (e.g. backend cold start). Surface a
      // friendly retry state instead of letting the exception go unhandled.
      // A failed "load more" keeps the existing items and just stops paging.
      if (!mounted) return;
      if (!append) {
        setState(() => _loadError =
            "Couldn't load the feed. Pull to refresh or tap retry.");
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _toggleLike(BrowseFeedItem item) async {
    if (_likingId != null) return;
    setState(() => _likingId = item.id);
    try {
      final res = await _service.toggleLike(item.id);
      final liked = res['liked'] == true;
      final likeCount =
          (res['likeCount'] ?? res['like_count'] ?? item.likeCount);
      if (!mounted) return;
      setState(() {
        _items = _items
            .map(
              (i) => i.id == item.id
                  ? i.copyWith(
                      liked: liked,
                      likeCount: likeCount is int
                          ? likeCount
                          : int.tryParse(likeCount.toString()) ?? i.likeCount,
                    )
                  : i,
            )
            .toList();
      });
    } finally {
      if (mounted) setState(() => _likingId = null);
    }
  }

  Future<void> _toggleBookmark(BrowseFeedItem item) async {
    if (_bookmarkingId != null) return;
    setState(() => _bookmarkingId = item.id);
    try {
      if (item.bookmarked) {
        await _service.removeBookmark(item.id);
        if (!mounted) return;
        setState(() {
          _items = _items
              .map(
                (i) => i.id == item.id
                    ? i.copyWith(
                        bookmarked: false,
                        bookmarkCount: (i.bookmarkCount - 1).clamp(0, 1 << 30),
                      )
                    : i,
              )
              .toList();
        });
      } else {
        await _service.addBookmark(item.id);
        if (!mounted) return;
        setState(() {
          _items = _items
              .map(
                (i) => i.id == item.id
                    ? i.copyWith(
                        bookmarked: true,
                        bookmarkCount: i.bookmarkCount + 1,
                      )
                    : i,
              )
              .toList();
        });
      }
    } finally {
      if (mounted) setState(() => _bookmarkingId = null);
    }
  }

  Future<void> _report(BrowseFeedItem item) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Report'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Reason',
              hintText: 'Spam, unsafe, copyrighted...',
            ),
            maxLines: 3,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Report'),
            ),
          ],
        );
      },
    );

    final reason = controller.text.trim();
    controller.dispose();
    if (ok != true) return;
    if (reason.isEmpty) return;
    await _service.report(item.id, reason);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Reported. Thanks for keeping it clean.')),
    );
  }

  Future<void> _previewAudio(String url) async {
    final player = AudioPlayer();
    await player.setUrl(url);
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Preview', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              StreamBuilder<PlayerState>(
                stream: player.playerStateStream,
                builder: (context, snap) {
                  final playing = snap.data?.playing == true;
                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        iconSize: 48,
                        onPressed: () =>
                            playing ? player.pause() : player.play(),
                        icon: Icon(
                          playing ? Icons.pause_circle : Icons.play_circle,
                        ),
                      ),
                      IconButton(
                        onPressed: () => player.stop(),
                        icon: const Icon(Icons.stop),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
    await player.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    final embedded = widget.onOpenNavDrawer != null;
    final tabScaffold = Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: embedded
              ? IconButton(
                  icon: const Icon(Icons.menu),
                  tooltip: 'Menu',
                  onPressed: widget.onOpenNavDrawer,
                )
              : null,
          title: const Text('Discover'),
          bottom: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Swipe'),
              Tab(text: 'Saved'),
              Tab(text: 'Artists'),
              Tab(text: 'Library'),
            ],
          ),
          actions: [
            IconButton(
              onPressed: () {
                Navigator.pushNamed(
                  context,
                  AppRoutes.discoverCreateVideo,
                ).then((_) {
                  final saved = _savedKey.currentState;
                  if (saved != null) unawaited(saved.reload());
                });
              },
              tooltip: 'Create Video',
              icon: const Icon(Icons.video_call_outlined),
            ),
            IconButton(
              onPressed: _hasArtistQuery
                  ? () => _searchArtists(_searchCtrl.text.trim())
                  : _onAppBarRefresh,
              tooltip: _hasArtistQuery ? 'Search' : 'Refresh',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: TextField(
                controller: _searchCtrl,
                textInputAction: TextInputAction.search,
                onSubmitted: (v) {
                  if (v.trim().length >= 2) {
                    unawaited(_searchArtists(v.trim()));
                  }
                },
                decoration: InputDecoration(
                  hintText: 'Search artists by name…',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchCtrl.text.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear',
                          onPressed: () {
                            _searchCtrl.clear();
                            setState(() {});
                          },
                          icon: const Icon(Icons.close),
                        ),
                  filled: true,
                  fillColor: scheme.surface.withValues(alpha: 0.55),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: DimensionTokens.neonCyan.withValues(alpha: 0.25),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: DimensionTokens.neonCyan.withValues(alpha: 0.18),
                    ),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                ),
              ),
            ),
            Expanded(
              child: _hasArtistQuery
                  ? _buildArtistSearchBody(surfaces)
                  : TabBarView(
          controller: _tabController,
          children: [
            DiscoverAudioTab(key: _swipeKey),
            _DiscoverListTab(key: _savedKey),
            _loading && _items.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : (_loadError != null && _items.isEmpty)
                ? RefreshIndicator(
                    onRefresh: () => _loadPage(append: false),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.cloud_off_outlined,
                                    size: 48,
                                    color: surfaces.textSecondary,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    _loadError!,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: surfaces.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  FilledButton.icon(
                                    onPressed: () => _loadPage(append: false),
                                    icon: const Icon(Icons.refresh),
                                    label: const Text('Retry'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : _items.isEmpty
                ? Center(
                    child: Text(
                      'No content in the feed yet.',
                      style: TextStyle(color: surfaces.textSecondary),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () => _loadPage(append: false),
                    child: GridView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(12),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 0.82,
                          ),
                      itemCount: _items.length + (_loadingMore ? 2 : 0),
                      itemBuilder: (context, idx) {
                        if (idx >= _items.length) {
                          return const Center(
                            child: CircularProgressIndicator(),
                          );
                        }
                        final item = _items[idx];
                        return Card(
                          clipBehavior: Clip.antiAlias,
                          child: Column(
                            children: [
                              Expanded(
                                child: Stack(
                                  children: [
                                    Positioned.fill(
                                      child: item.type == 'image'
                                          ? Image.network(
                                              item.fileUrl,
                                              fit: BoxFit.cover,
                                              errorBuilder:
                                                  (
                                                    context,
                                                    error,
                                                    stackTrace,
                                                  ) => const Center(
                                                    child: Icon(
                                                      Icons.broken_image,
                                                    ),
                                                  ),
                                            )
                                          : Container(
                                              decoration: BoxDecoration(
                                                gradient:
                                                    surfaces.signatureGradient,
                                              ),
                                              child: Center(
                                                child: FilledButton.tonalIcon(
                                                  onPressed: () =>
                                                      _previewAudio(
                                                        item.fileUrl,
                                                      ),
                                                  icon: const Icon(
                                                    Icons.play_arrow,
                                                  ),
                                                  label: const Text('Preview'),
                                                ),
                                              ),
                                            ),
                                    ),
                                    Positioned(
                                      left: 8,
                                      bottom: 8,
                                      right: 8,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.black.withValues(
                                            alpha: 0.45,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 10,
                                              backgroundColor: scheme.primary
                                                  .withValues(alpha: 0.25),
                                              backgroundImage:
                                                  item.provider.avatarUrl ==
                                                      null
                                                  ? null
                                                  : NetworkImage(
                                                      item.provider.avatarUrl!,
                                                    ),
                                              child:
                                                  item.provider.avatarUrl ==
                                                      null
                                                  ? Text(
                                                      (item
                                                                  .provider
                                                                  .displayName ??
                                                              '?')
                                                          .characters
                                                          .first
                                                          .toUpperCase(),
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                      ),
                                                    )
                                                  : null,
                                            ),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                item.provider.displayName ??
                                                    'Creator',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.all(10),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.title ?? 'Untitled',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (item.description != null &&
                                        item.description!.isNotEmpty)
                                      Text(
                                        item.description!,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: surfaces.textSecondary,
                                          fontSize: 12,
                                        ),
                                      ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        IconButton(
                                          tooltip: 'Ripple',
                                          onPressed: _likingId == item.id
                                              ? null
                                              : () => _toggleLike(item),
                                          icon: Text(item.liked ? '❤️' : '🤍'),
                                        ),
                                        Text(
                                          '${item.likeCount}',
                                          style: TextStyle(
                                            color: surfaces.textMuted,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          tooltip: 'Save',
                                          onPressed: _bookmarkingId == item.id
                                              ? null
                                              : () => _toggleBookmark(item),
                                          icon: Text(
                                            item.bookmarked ? '🔖' : '📑',
                                          ),
                                        ),
                                        Text(
                                          '${item.bookmarkCount}',
                                          style: TextStyle(
                                            color: surfaces.textMuted,
                                          ),
                                        ),
                                        const Spacer(),
                                        IconButton(
                                          tooltip: 'Report',
                                          onPressed: () => _report(item),
                                          icon: Icon(
                                            Icons.flag_outlined,
                                            color: surfaces.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
            _LibraryTab(key: _libraryKey),
          ],
        ),
            ),
          ],
        ),
    );

    // Pushed from the drawer (no home backdrop) — wrap in Dimension chrome.
    if (embedded) return tabScaffold;
    return DimensionScreenShell(
      title: null,
      showNeonLine: false,
      body: tabScaffold,
    );
  }

  Widget _buildArtistSearchBody(NetworxSurfaces surfaces) {
    if (_searchingArtists && _artistResults.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_artistSearchError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _artistSearchError!,
                textAlign: TextAlign.center,
                style: TextStyle(color: surfaces.textSecondary),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => _searchArtists(_searchCtrl.text.trim()),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (_artistResults.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No artists match “${_searchCtrl.text.trim()}”.',
            textAlign: TextAlign.center,
            style: TextStyle(color: surfaces.textSecondary),
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
      itemCount: _artistResults.length + (_searchingArtists ? 1 : 0),
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        if (index >= _artistResults.length) {
          return const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        final person = _artistResults[index];
        final name = (person['displayName'] ??
                person['display_name'] ??
                'Artist')
            .toString();
        final headline = (person['headline'] ?? '').toString();
        final location = (person['locationRegion'] ??
                person['location_region'] ??
                '')
            .toString();
        final avatar = (person['avatarUrl'] ?? person['avatar_url'] ?? '')
            .toString();
        final subtitle = [
          if (headline.isNotEmpty) headline,
          if (location.isNotEmpty) location,
        ].join(' · ');

        return Card(
          child: ListTile(
            onTap: () => _openArtist(person),
            leading: CircleAvatar(
              backgroundColor:
                  DimensionTokens.neonCyan.withValues(alpha: 0.15),
              backgroundImage:
                  avatar.isNotEmpty ? NetworkImage(avatar) : null,
              child: avatar.isEmpty
                  ? Text(
                      name.isNotEmpty ? name[0].toUpperCase() : '?',
                      style: TextStyle(
                        color: DimensionTokens.neonCyan,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : null,
            ),
            title: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            subtitle: subtitle.isEmpty
                ? null
                : Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
            trailing: const Icon(Icons.chevron_right),
          ),
        );
      },
    );
  }
}

// _FeedTab + _FeedPostComposer were removed: posting now happens only inside
// Pro-Networx, and the read-only Pro-Networx feed reader lives in
// `features/social/social_feed_screen.dart`.

class _DiscoverListTab extends StatefulWidget {
  const _DiscoverListTab({super.key});

  @override
  State<_DiscoverListTab> createState() => _DiscoverListTabState();
}

class _DiscoverListTabState extends State<_DiscoverListTab> {
  final DiscoverAudioService _service = DiscoverAudioService();
  bool _loading = true;
  bool _clearing = false;
  String? _removingSongId;
  List<DiscoverAudioLikedItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> reload() => _load();

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _service.getLikedList(limit: 100, offset: 0);
      if (!mounted) return;
      setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(String songId) async {
    setState(() => _removingSongId = songId);
    try {
      await _service.removeLikedSong(songId);
      await _service.removeSwipe(songId);
      if (!mounted) return;
      setState(() => _items = _items.where((i) => i.songId != songId).toList());
    } finally {
      if (mounted) setState(() => _removingSongId = null);
    }
  }

  Future<void> _clearAll() async {
    if (_items.isEmpty || _clearing) return;
    setState(() => _clearing = true);
    try {
      await _service.clearLikedList();
      if (!mounted) return;
      setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _clearing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) {
      return Center(
        child: Text(
          'No liked songs yet. Swipe right (Like) on Discover to save them here.',
          textAlign: TextAlign.center,
          style: TextStyle(color: surfaces.textSecondary),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length + 1,
        itemBuilder: (context, i) {
          if (i == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: _clearing ? null : _clearAll,
                  icon: const Icon(Icons.clear_all),
                  label: Text(_clearing ? 'Clearing...' : 'Clear list'),
                ),
              ),
            );
          }
          final item = _items[i - 1];
          final canMakeVideo = item.clipUrl.trim().isNotEmpty;
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading:
                  item.backgroundUrl != null && item.backgroundUrl!.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(
                        DimensionTokens.tileRadius,
                      ),
                      child: Image.network(
                        item.backgroundUrl!,
                        width: 44,
                        height: 44,
                        fit: BoxFit.cover,
                      ),
                    )
                  : const Icon(Icons.music_note),
              title: Text(item.title),
              subtitle: Text(item.artistDisplayName ?? item.artistName),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (canMakeVideo)
                    IconButton(
                      tooltip: 'Make video',
                      onPressed: () {
                        Navigator.pushNamed(
                          context,
                          AppRoutes.discoverCreateVideo,
                          arguments: {
                            'clipUrl': item.clipUrl,
                            'title': item.title,
                            'artistName':
                                item.artistDisplayName ?? item.artistName,
                            'songId': item.songId,
                          },
                        );
                      },
                      icon: const Icon(Icons.videocam_outlined),
                    ),
                  IconButton(
                    onPressed: _removingSongId == item.songId
                        ? null
                        : () => _remove(item.songId),
                    icon: const Icon(Icons.delete_outline),
                    tooltip: 'Remove',
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LibraryTab extends StatefulWidget {
  const _LibraryTab({super.key});

  @override
  State<_LibraryTab> createState() => _LibraryTabState();
}

class _LibraryTabState extends State<_LibraryTab> {
  final SongsService _songs = SongsService();
  final DiscoverAudioService _discover = DiscoverAudioService();

  // 'liked' / 'disliked' = Discover swipes; 'music' = purchases.
  String _section = 'liked';
  bool _historyLoading = true;
  List<DiscoverAudioHistoryItem> _liked = const [];
  List<DiscoverAudioHistoryItem> _disliked = const [];
  String? _busyHistoryId;

  bool _purchasesLoading = true;
  List<PurchasedSong> _purchases = const [];
  String? _busyPurchaseId;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _loadPurchases();
  }

  Future<void> reload() async {
    await Future.wait([_loadHistory(), _loadPurchases()]);
  }

  Future<void> _loadHistory() async {
    setState(() => _historyLoading = true);
    try {
      final results = await Future.wait([
        _discover.getHistory(direction: 'right_like', limit: 100),
        _discover.getHistory(direction: 'left_skip', limit: 100),
      ]);
      if (!mounted) return;
      setState(() {
        _liked = results[0];
        _disliked = results[1];
      });
    } catch (_) {
      // Best-effort.
    } finally {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _loadPurchases() async {
    setState(() => _purchasesLoading = true);
    try {
      final items = await _songs.getPurchases(limit: 100, offset: 0);
      if (!mounted) return;
      setState(() => _purchases = items);
    } catch (_) {
      // Best-effort.
    } finally {
      if (mounted) setState(() => _purchasesLoading = false);
    }
  }

  Future<void> _removeHistory(DiscoverAudioHistoryItem item) async {
    setState(() => _busyHistoryId = item.songId);
    try {
      if (item.isLiked) {
        await _discover.removeLikedSong(item.songId);
      }
      await _discover.removeSwipe(item.songId);
      if (!mounted) return;
      setState(() {
        if (item.isLiked) {
          _liked = _liked.where((i) => i.songId != item.songId).toList();
        } else {
          _disliked =
              _disliked.where((i) => i.songId != item.songId).toList();
        }
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not remove: $e')),
      );
    } finally {
      if (mounted) setState(() => _busyHistoryId = null);
    }
  }

  Future<void> _playDiscoverClip(DiscoverAudioHistoryItem item) async {
    if (item.clipUrl.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No discover clip available.')),
      );
      return;
    }
    try {
      final player = AudioPlayerService().player;
      await player.setAudioSource(
        AudioSource.uri(
          Uri.parse(item.clipUrl),
          tag: MediaItem(
            id: item.songId,
            title: item.title,
            artist: item.artistDisplayName ?? item.artistName,
            artUri: BrandAssets.mediaArtUri(item.backgroundUrl),
            extras: const {'source': 'sample', 'noSeek': true},
          ),
        ),
      );
      await player.play();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not play: $e')));
    }
  }

  Future<void> _playPurchased(PurchasedSong item) async {
    setState(() => _busyPurchaseId = item.id);
    try {
      final url = await _songs.getStreamUrl(item.id);
      if (url == null || url.isEmpty) {
        throw Exception('Stream unavailable.');
      }
      final player = AudioPlayerService().player;
      // Tag the source so the bottom bar shows this track with a seek slider
      // (purchased = full entitled stream, scrubbing allowed).
      await player.setAudioSource(
        AudioSource.uri(
          Uri.parse(url),
          tag: MediaItem(
            id: item.id,
            title: item.title,
            artist: item.artistName,
            artUri: BrandAssets.mediaArtUri(item.artworkUrl),
            extras: const {'source': 'discography'},
          ),
        ),
      );
      await player.play();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not play: $e')));
    } finally {
      if (mounted) setState(() => _busyPurchaseId = null);
    }
  }

  Future<void> _downloadPurchased(PurchasedSong item) async {
    setState(() => _busyPurchaseId = item.id);
    try {
      final url = await _songs.getDownloadUrl(item.id);
      if (url == null || url.isEmpty) {
        throw Exception('Download link unavailable.');
      }
      final uri = Uri.tryParse(url);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Download failed: $e')));
    } finally {
      if (mounted) setState(() => _busyPurchaseId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'liked',
                label: Text('Liked'),
                icon: Icon(Icons.favorite_border),
              ),
              ButtonSegment(
                value: 'disliked',
                label: Text('Disliked'),
                icon: Icon(Icons.thumb_down_alt_outlined),
              ),
              ButtonSegment(
                value: 'music',
                label: Text('My Music'),
                icon: Icon(Icons.library_music_outlined),
              ),
            ],
            selected: {_section},
            onSelectionChanged: (s) => setState(() => _section = s.first),
          ),
        ),
        Expanded(
          child: switch (_section) {
            'liked' => _buildHistorySection(
              surfaces,
              items: _liked,
              emptyMessage:
                  'No liked songs yet. Swipe right (Like) on Discover to add them here.',
            ),
            'disliked' => _buildHistorySection(
              surfaces,
              items: _disliked,
              emptyMessage:
                  'No disliked songs yet. Swipe left (Dislike) on Discover to add them here.',
            ),
            _ => _buildMusicSection(surfaces),
          },
        ),
      ],
    );
  }

  Widget _buildHistorySection(
    NetworxSurfaces surfaces, {
    required List<DiscoverAudioHistoryItem> items,
    required String emptyMessage,
  }) {
    if (_historyLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadHistory,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 80),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: TextStyle(color: surfaces.textSecondary),
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadHistory,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          final busy = _busyHistoryId == item.songId;
          final art = item.backgroundUrl;
          return Card(
            child: ListTile(
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(
                  DimensionTokens.tileRadius,
                ),
                child: (art != null && art.isNotEmpty)
                    ? Image.network(
                        art,
                        width: 44,
                        height: 44,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => _artworkFallback(surfaces),
                      )
                    : _artworkFallback(surfaces),
              ),
              title: Text(
                item.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                item.artistDisplayName ?? item.artistName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (item.isLiked && item.clipUrl.trim().isNotEmpty)
                    IconButton(
                      tooltip: 'Make video',
                      onPressed: busy
                          ? null
                          : () {
                              Navigator.pushNamed(
                                context,
                                AppRoutes.discoverCreateVideo,
                                arguments: {
                                  'clipUrl': item.clipUrl,
                                  'title': item.title,
                                  'artistName': item.artistDisplayName ??
                                      item.artistName,
                                  'songId': item.songId,
                                },
                              );
                            },
                      icon: const Icon(Icons.videocam_outlined),
                    ),
                  IconButton(
                    tooltip: 'Play clip',
                    onPressed: busy ? null : () => _playDiscoverClip(item),
                    icon: const Icon(Icons.play_arrow),
                  ),
                  IconButton(
                    tooltip: 'Remove (show in Discover again)',
                    onPressed: busy ? null : () => _removeHistory(item),
                    icon: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.delete_outline),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMusicSection(NetworxSurfaces surfaces) {
    if (_purchasesLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_purchases.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Nothing here yet. Buy a song from an artist — or upload your '
            'own — to play it in full and download it here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: surfaces.textSecondary),
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadPurchases,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _purchases.length,
        separatorBuilder: (_, index) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final item = _purchases[i];
          final busy = _busyPurchaseId == item.id;
          return Card(
            child: ListTile(
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(DimensionTokens.tileRadius),
                child:
                    (item.artworkUrl != null && item.artworkUrl!.isNotEmpty)
                    ? Image.network(
                        item.artworkUrl!,
                        width: 44,
                        height: 44,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => _artworkFallback(surfaces),
                      )
                    : _artworkFallback(surfaces),
              ),
              title: Text(item.title),
              subtitle: Text(
                '${item.artistName} · ${item.isOwnUpload ? 'Your upload' : 'Purchased'}',
                style: TextStyle(color: surfaces.textSecondary),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Play',
                    icon: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child:
                                CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.play_arrow),
                    onPressed: busy ? null : () => _playPurchased(item),
                  ),
                  IconButton(
                    tooltip: 'Download',
                    icon: const Icon(Icons.download_outlined),
                    onPressed: busy ? null : () => _downloadPurchased(item),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _artworkFallback(NetworxSurfaces surfaces) {
    return Container(
      width: 44,
      height: 44,
      color: surfaces.textSecondary.withValues(alpha: 0.12),
      child: const Icon(Icons.music_note, size: 22),
    );
  }
}
