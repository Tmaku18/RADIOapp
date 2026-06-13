import 'dart:async';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/models/browse_models.dart';
import '../../core/models/discover_audio_models.dart';
import '../../core/services/browse_like_events_service.dart';
import '../../core/services/browse_service.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/payments_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/networx_extensions.dart';
import 'discover_audio_tab.dart';

class DiscoveryScreen extends StatefulWidget {
  const DiscoveryScreen({super.key});

  @override
  State<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends State<DiscoveryScreen> {
  static const int _pageSize = 12;
  final BrowseService _service = BrowseService();
  final BrowseLikeEventsService _likeEvents = BrowseLikeEventsService();
  final ScrollController _scroll = ScrollController();
  final String _seed = DateTime.now().millisecondsSinceEpoch.toString();
  StreamSubscription<BrowseLikeEvent>? _likeEventsSub;

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
    _likeEventsSub?.cancel();
    _likeEvents.stop();
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

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Discover'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
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
                  '/discover-create-video',
                );
              },
              tooltip: 'Create Video',
              icon: const Icon(Icons.video_call_outlined),
            ),
            IconButton(
              onPressed: () => _loadPage(append: false),
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: TabBarView(
          children: [
            const DiscoverAudioTab(),
            const _DiscoverListTab(),
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
            const _LibraryTab(),
          ],
        ),
      ),
    );
  }
}

// _FeedTab + _FeedPostComposer were removed: posting now happens only inside
// Pro-Networx, and the read-only Pro-Networx feed reader lives in
// `features/social/social_feed_screen.dart`.

class _DiscoverListTab extends StatefulWidget {
  const _DiscoverListTab();

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
          'Your Discover list is empty. Swipe right in Discover to add songs.',
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
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading:
                  item.backgroundUrl != null && item.backgroundUrl!.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(8),
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
              trailing: IconButton(
                onPressed: _removingSongId == item.songId
                    ? null
                    : () => _remove(item.songId),
                icon: const Icon(Icons.delete_outline),
                tooltip: 'Remove',
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LibraryTab extends StatefulWidget {
  const _LibraryTab();

  @override
  State<_LibraryTab> createState() => _LibraryTabState();
}

class _LibraryTabState extends State<_LibraryTab> {
  final SongsService _songs = SongsService();
  final PaymentsService _payments = PaymentsService();
  bool _loading = true;
  List<LibrarySong> _items = const [];
  String _sortBy = 'recent';
  String? _busyLikedId;

  // 'liked' = saved/liked songs (30s sample only).
  // 'music' = purchased songs (full play + download).
  String _section = 'liked';
  bool _purchasesLoading = true;
  List<PurchasedSong> _purchases = const [];
  String? _busyPurchaseId;

  static const List<DropdownMenuItem<String>> _sortOptions = [
    DropdownMenuItem(value: 'recent', child: Text('Recently added')),
    DropdownMenuItem(value: 'oldest', child: Text('Oldest added')),
    DropdownMenuItem(value: 'artist', child: Text('Artist')),
    DropdownMenuItem(value: 'title', child: Text('Song title')),
    DropdownMenuItem(value: 'likes', child: Text('Likes')),
    DropdownMenuItem(value: 'plays', child: Text('Listens')),
    DropdownMenuItem(value: 'temperature', child: Text('Temperature')),
  ];

  @override
  void initState() {
    super.initState();
    _load();
    _loadPurchases();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _songs.getLibrary(limit: 100, offset: 0);
      if (!mounted) return;
      setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
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

  Future<void> _playPurchased(PurchasedSong item) async {
    setState(() => _busyPurchaseId = item.id);
    try {
      final url = await _songs.getStreamUrl(item.id);
      if (url == null || url.isEmpty) {
        throw Exception('Stream unavailable.');
      }
      final player = AudioPlayerService().player;
      await player.setAudioSource(AudioSource.uri(Uri.parse(url)));
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

  Future<void> _remove(LibrarySong item) async {
    await _songs.unlike(item.id);
    if (!mounted) return;
    setState(() => _items = _items.where((i) => i.id != item.id).toList());
  }

  Future<void> _playUrl(String? url, String missingMessage) async {
    if (url == null || url.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(missingMessage)));
      return;
    }
    try {
      final player = AudioPlayerService().player;
      await player.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await player.play();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not play: $e')));
    }
  }

  Future<void> _playSample(LibrarySong item) =>
      _playUrl(item.sampleUrl ?? item.audioUrl, 'No sample available yet.');

  Future<void> _playClip(LibrarySong item) =>
      _playUrl(item.discoverClipUrl, 'This song has no discover clip.');

  Future<void> _playFull(LibrarySong item) async {
    setState(() => _busyLikedId = item.id);
    try {
      final url = await _songs.getStreamUrl(item.id);
      await _playUrl(url, 'Could not play the full song.');
    } finally {
      if (mounted) setState(() => _busyLikedId = null);
    }
  }

  Future<void> _buyLiked(LibrarySong item) async {
    setState(() => _busyLikedId = item.id);
    try {
      final res = await _payments.buySong(songId: item.id);
      final url = (res['url'] ?? res['checkoutUrl'])?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Could not start checkout.');
      }
      final uri = Uri.tryParse(url);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Complete your purchase in the browser, then pull to refresh.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Purchase failed: $e')));
    } finally {
      if (mounted) setState(() => _busyLikedId = null);
    }
  }

  String _formatPrice(int cents) {
    final dollars = cents / 100;
    final text = dollars.toStringAsFixed(2);
    return '\$${text.endsWith('.00') ? text.substring(0, text.length - 3) : text}';
  }

  List<LibrarySong> get _sortedItems {
    final list = [..._items];
    int byDateDesc(LibrarySong a, LibrarySong b) {
      final av = a.likedAt;
      final bv = b.likedAt;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv.compareTo(av);
    }

    switch (_sortBy) {
      case 'oldest':
        list.sort((a, b) => -byDateDesc(a, b));
        break;
      case 'artist':
        list.sort(
          (a, b) =>
              a.artistName.toLowerCase().compareTo(b.artistName.toLowerCase()),
        );
        break;
      case 'title':
        list.sort(
          (a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()),
        );
        break;
      case 'likes':
        list.sort((a, b) => b.likeCount.compareTo(a.likeCount));
        break;
      case 'plays':
        list.sort((a, b) => b.playCount.compareTo(a.playCount));
        break;
      case 'temperature':
        list.sort(
          (a, b) => b.temperaturePercent.compareTo(a.temperaturePercent),
        );
        break;
      case 'recent':
      default:
        list.sort(byDateDesc);
        break;
    }
    return list;
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
                value: 'music',
                label: Text('My Music'),
                icon: Icon(Icons.library_music_outlined),
              ),
            ],
            selected: {_section},
            onSelectionChanged: (s) =>
                setState(() => _section = s.first),
          ),
        ),
        Expanded(
          child: _section == 'liked'
              ? _buildLikedSection(surfaces)
              : _buildMusicSection(surfaces),
        ),
      ],
    );
  }

  Widget _buildLikedSection(NetworxSurfaces surfaces) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'No liked songs yet. Give a song 🔥 on the radio to save its 30-second sample here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: surfaces.textSecondary),
          ),
        ),
      );
    }
    final items = _sortedItems;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('Sort by', style: TextStyle(color: surfaces.textSecondary)),
              const SizedBox(width: 8),
              DropdownButton<String>(
                value: _sortBy,
                items: _sortOptions,
                onChanged: (value) {
                  if (value != null) setState(() => _sortBy = value);
                },
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, index) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final item = items[i];
                final busy = _busyLikedId == item.id;
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 8, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child:
                                  (item.artworkUrl != null &&
                                      item.artworkUrl!.isNotEmpty)
                                  ? Image.network(
                                      item.artworkUrl!,
                                      width: 44,
                                      height: 44,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) =>
                                          _artworkFallback(surfaces),
                                    )
                                  : _artworkFallback(surfaces),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    item.artistName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: surfaces.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Remove',
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => _remove(item),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '♥ ${item.likeCount}   🎧 ${item.playCount} listens   🌡 ${item.temperaturePercent}%',
                          style: TextStyle(
                            fontSize: 12,
                            color: surfaces.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _playSample(item),
                              icon: const Icon(Icons.play_arrow, size: 18),
                              label: const Text('Sample'),
                            ),
                            if (item.discoverEnabled &&
                                item.discoverClipUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _playClip(item),
                                icon: const Icon(
                                  Icons.auto_awesome,
                                  size: 18,
                                ),
                                label: const Text('Discover clip'),
                              ),
                            if (item.owned)
                              FilledButton.icon(
                                onPressed: busy ? null : () => _playFull(item),
                                icon: busy
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.play_arrow, size: 18),
                                label: const Text('Play full'),
                              )
                            else if (item.forSale)
                              FilledButton(
                                onPressed: busy ? null : () => _buyLiked(item),
                                child: busy
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text('Buy ${_formatPrice(item.priceCents)}'),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
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
            'No purchased music yet. Buy a song from an artist to play it in '
            'full and download it here.',
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
                borderRadius: BorderRadius.circular(8),
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
                '${item.artistName} · Purchased',
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
