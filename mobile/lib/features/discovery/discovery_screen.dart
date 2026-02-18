import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../core/models/browse_models.dart';
import '../../core/models/competition_models.dart';
import '../../core/services/browse_service.dart';
import '../../core/services/competition_service.dart';
import '../../core/theme/networx_extensions.dart';

class DiscoveryScreen extends StatefulWidget {
  const DiscoveryScreen({super.key});

  @override
  State<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends State<DiscoveryScreen> {
  static const int _pageSize = 12;
  final BrowseService _service = BrowseService();
  final ScrollController _scroll = ScrollController();
  final String _seed = DateTime.now().millisecondsSinceEpoch.toString();

  bool _loading = true;
  bool _loadingMore = false;
  String? _nextCursor;
  List<BrowseFeedItem> _items = <BrowseFeedItem>[];

  String? _likingId;
  String? _bookmarkingId;

  @override
  void initState() {
    super.initState();
    _loadPage(append: false);
    _scroll.addListener(() {
      if (_nextCursor == null || _loadingMore) return;
      if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 300) {
        _loadPage(append: true);
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadPage({required bool append}) async {
    if (append) {
      setState(() => _loadingMore = true);
    } else {
      setState(() => _loading = true);
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
      });
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
      final likeCount = (res['likeCount'] ?? res['like_count'] ?? item.likeCount);
      if (!mounted) return;
      setState(() {
        _items = _items
            .map((i) => i.id == item.id
                ? i.copyWith(
                    liked: liked,
                    likeCount: likeCount is int
                        ? likeCount
                        : int.tryParse(likeCount.toString()) ?? i.likeCount,
                  )
                : i)
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
              .map((i) => i.id == item.id
                  ? i.copyWith(
                      bookmarked: false,
                      bookmarkCount: (i.bookmarkCount - 1).clamp(0, 1 << 30),
                    )
                  : i)
              .toList();
        });
      } else {
        await _service.addBookmark(item.id);
        if (!mounted) return;
        setState(() {
          _items = _items
              .map((i) => i.id == item.id
                  ? i.copyWith(
                      bookmarked: true,
                      bookmarkCount: i.bookmarkCount + 1,
                    )
                  : i)
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

    if (ok != true) return;
    final reason = controller.text.trim();
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
                        onPressed: () => playing ? player.pause() : player.play(),
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

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Discovery'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Browse'),
              Tab(text: 'Top'),
              Tab(text: 'Saved'),
            ],
          ),
          actions: [
            IconButton(
              onPressed: () => _loadPage(append: false),
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: TabBarView(
          children: [
            _loading && _items.isEmpty
                ? const Center(child: CircularProgressIndicator())
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
                                                  errorBuilder: (context, error, stackTrace) =>
                                                      const Center(
                                                    child: Icon(Icons.broken_image),
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
                                                          _previewAudio(item.fileUrl),
                                                      icon: const Icon(Icons.play_arrow),
                                                      label:
                                                          const Text('Preview'),
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
                                                horizontal: 10, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: Colors.black
                                                  .withValues(alpha: 0.45),
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                            ),
                                            child: Row(
                                              children: [
                                                CircleAvatar(
                                                  radius: 10,
                                                  backgroundColor: scheme.primary
                                                      .withValues(alpha: 0.25),
                                                  backgroundImage: item.provider
                                                              .avatarUrl ==
                                                          null
                                                      ? null
                                                      : NetworkImage(item
                                                          .provider.avatarUrl!),
                                                  child: item.provider.avatarUrl ==
                                                          null
                                                      ? Text(
                                                          (item.provider
                                                                      .displayName ??
                                                                  '?')
                                                              .characters
                                                              .first
                                                              .toUpperCase(),
                                                          style: const TextStyle(
                                                              fontSize: 11,
                                                              fontWeight:
                                                                  FontWeight.bold),
                                                        )
                                                      : null,
                                                ),
                                                const SizedBox(width: 8),
                                                Expanded(
                                                  child: Text(
                                                    item.provider.displayName ??
                                                        'Creator',
                                                    maxLines: 1,
                                                    overflow:
                                                        TextOverflow.ellipsis,
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
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.title ?? 'Untitled',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w600),
                                        ),
                                        if (item.description != null &&
                                            item.description!.isNotEmpty)
                                          Text(
                                            item.description!,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                                color: surfaces.textSecondary,
                                                fontSize: 12),
                                          ),
                                        const SizedBox(height: 6),
                                        Row(
                                          children: [
                                            IconButton(
                                              tooltip: 'Like',
                                              onPressed: _likingId == item.id
                                                  ? null
                                                  : () => _toggleLike(item),
                                              icon: Text(item.liked ? '❤️' : '🤍'),
                                            ),
                                            Text(
                                              '${item.likeCount}',
                                              style: TextStyle(
                                                  color: surfaces.textMuted),
                                            ),
                                            const SizedBox(width: 8),
                                            IconButton(
                                              tooltip: 'Save',
                                              onPressed: _bookmarkingId == item.id
                                                  ? null
                                                  : () => _toggleBookmark(item),
                                              icon: Text(item.bookmarked ? '🔖' : '📑'),
                                            ),
                                            Text(
                                              '${item.bookmarkCount}',
                                              style: TextStyle(
                                                  color: surfaces.textMuted),
                                            ),
                                            const Spacer(),
                                            IconButton(
                                              tooltip: 'Report',
                                              onPressed: () => _report(item),
                                              icon: Icon(Icons.flag_outlined,
                                                  color: surfaces.textMuted),
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
            const _TopTab(),
            _SavedTab(service: _service),
          ],
        ),
      ),
    );
  }
}

class _TopTab extends StatefulWidget {
  const _TopTab();

  @override
  State<_TopTab> createState() => _TopTabState();
}

class _TopTabState extends State<_TopTab> {
  final CompetitionService _service = CompetitionService();
  bool _loading = true;
  List<BrowseLeaderboardCategory> _cats = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final cats = await _service.getBrowseLeaderboard(limitPerCategory: 5);
      if (!mounted) return;
      setState(() => _cats = cats);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_cats.isEmpty) {
      return Center(
        child: Text(
          'No category leaders yet.',
          style: TextStyle(color: surfaces.textSecondary),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _cats.length,
        itemBuilder: (context, idx) {
          final cat = _cats[idx];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cat.serviceType.replaceAll('_', ' '),
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontFamily: 'Lora'),
                    ),
                    const SizedBox(height: 8),
                    ...cat.items.take(5).toList().asMap().entries.map((e) {
                      final i = e.key;
                      final item = e.value;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 22,
                              child: Text(
                                '${i + 1}',
                                style: TextStyle(color: surfaces.textMuted),
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title ?? 'Untitled',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis),
                                  Text(
                                    item.providerDisplayName ?? 'Creator',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        color: surfaces.textSecondary,
                                        fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              '${item.likeCount} likes',
                              style: TextStyle(color: surfaces.textMuted),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SavedTab extends StatefulWidget {
  final BrowseService service;
  const _SavedTab({required this.service});

  @override
  State<_SavedTab> createState() => _SavedTabState();
}

class _SavedTabState extends State<_SavedTab> {
  bool _loading = true;
  List<BrowseFeedItem> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await widget.service.getBookmarks(limit: 100);
      if (!mounted) return;
      setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _remove(BrowseFeedItem item) async {
    await widget.service.removeBookmark(item.id);
    if (!mounted) return;
    setState(() => _items = _items.where((i) => i.id != item.id).toList());
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) {
      return Center(
        child: Text(
          'No saved items.',
          style: TextStyle(color: surfaces.textSecondary),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        separatorBuilder: (_, index) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final item = _items[i];
          return Card(
            child: ListTile(
              title: Text(item.title ?? 'Untitled'),
              subtitle: Text(
                item.provider.displayName ?? 'Creator',
                style: TextStyle(color: surfaces.textSecondary),
              ),
              trailing: IconButton(
                tooltip: 'Remove',
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _remove(item),
              ),
            ),
          );
        },
      ),
    );
  }
}

