import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http_parser/http_parser.dart' as http_parser;
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../../core/auth/auth_service.dart';
import '../../core/models/browse_models.dart';
import '../../core/models/discover_audio_models.dart';
import '../../core/models/discovery_map_models.dart';
import '../../core/services/browse_like_events_service.dart';
import '../../core/services/browse_service.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/discovery_map_service.dart';
import '../../core/services/api_service.dart';
import '../../core/services/songs_service.dart';
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
      length: 6,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Social'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Discover'),
              Tab(text: 'Discover List'),
              Tab(text: 'Artists'),
              Tab(text: 'Map'),
              Tab(text: 'Feed'),
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
            const _MapTab(),
            const _FeedTab(),
            const _LibraryTab(),
          ],
        ),
      ),
    );
  }
}

class _FeedTab extends StatefulWidget {
  const _FeedTab();

  @override
  State<_FeedTab> createState() => _FeedTabState();
}

class _FeedTabState extends State<_FeedTab> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<Map<String, dynamic>> _posts = const [];
  String? _role;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final profile = await auth.getUserProfile();
      if (mounted) _role = profile?.role;
    } catch (_) {}
    await _loadFeed();
  }

  Future<void> _loadFeed() async {
    try {
      final res = await _api.get('discovery/feed?limit=20');
      List<Map<String, dynamic>> posts = const [];
      if (res is Map<String, dynamic>) {
        final raw = (res['items'] as List?) ?? const [];
        posts = raw
            .whereType<Map>()
            .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
            .toList();
      }
      if (!mounted) return;
      setState(() => _posts = posts);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canPost =>
      _role == 'service_provider' || _role == 'admin';

  void _openComposer() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _FeedPostComposer(),
    ).then((posted) {
      if (posted == true) _loadFeed();
    });
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());

    Widget body;
    if (_posts.isEmpty) {
      body = Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'No posts yet.',
              style: TextStyle(color: surfaces.textSecondary),
            ),
            const SizedBox(height: 4),
            Text(
              'Catalysts can share photos and short videos here — check back soon.',
              textAlign: TextAlign.center,
              style: TextStyle(color: surfaces.textMuted, fontSize: 13),
            ),
          ],
        ),
      );
    } else {
      body = RefreshIndicator(
        onRefresh: _loadFeed,
        child: ListView.builder(
          padding: const EdgeInsets.all(12),
          itemCount: _posts.length,
          itemBuilder: (context, idx) {
            final post = _posts[idx];
            final imageUrl = post['imageUrl']?.toString() ?? '';
            final caption = post['caption']?.toString();
            final author =
                post['authorDisplayName']?.toString() ?? 'Creator';
            final createdAt = post['createdAt']?.toString();
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        author,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontFamily: 'Lora'),
                      ),
                      if (imageUrl.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            imageUrl,
                            height: 180,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                Container(
                                  height: 180,
                                  alignment: Alignment.center,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .surfaceContainer,
                                  child: const Icon(
                                      Icons.broken_image_outlined),
                                ),
                          ),
                        ),
                      ],
                      if ((caption ?? '').isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          caption!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                      if ((createdAt ?? '').isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          DateTime.tryParse(createdAt!)
                                  ?.toLocal()
                                  .toString()
                                  .split('.')
                                  .first ??
                              createdAt,
                          style: TextStyle(
                            color: surfaces.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      );
    }

    return Stack(
      children: [
        body,
        if (_canPost)
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton(
              heroTag: 'feed_post_fab',
              onPressed: _openComposer,
              child: const Icon(Icons.add_photo_alternate_outlined),
            ),
          ),
      ],
    );
  }
}

/// Bottom-sheet composer for creating a new feed post (image or video + caption).
class _FeedPostComposer extends StatefulWidget {
  const _FeedPostComposer();
  @override
  State<_FeedPostComposer> createState() => _FeedPostComposerState();
}

class _FeedPostComposerState extends State<_FeedPostComposer> {
  static const int _maxFileSizeBytes = 15 * 1024 * 1024; // 15 MB
  static const int _maxVideoDurationSec = 15;

  final ApiService _api = ApiService();
  final _captionCtrl = TextEditingController();
  File? _pickedFile;
  bool _isVideo = false;
  bool _uploading = false;
  String? _error;

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1920,
      maxHeight: 1920,
    );
    if (picked == null) return;
    final file = File(picked.path);
    final size = await file.length();
    if (size > _maxFileSizeBytes) {
      setState(() => _error = 'File too large (max 15 MB)');
      return;
    }
    setState(() {
      _pickedFile = file;
      _isVideo = false;
      _error = null;
    });
  }

  Future<void> _pickVideo() async {
    final picked = await ImagePicker().pickVideo(
      source: ImageSource.gallery,
      maxDuration: const Duration(seconds: _maxVideoDurationSec),
    );
    if (picked == null) return;
    final file = File(picked.path);
    final size = await file.length();
    if (size > _maxFileSizeBytes) {
      setState(() => _error = 'File too large (max 15 MB)');
      return;
    }
    setState(() {
      _pickedFile = file;
      _isVideo = true;
      _error = null;
    });
  }

  String _mimeForPath(String path) {
    final ext = path.split('.').last.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      default:
        return 'application/octet-stream';
    }
  }

  Future<void> _submit() async {
    if (_pickedFile == null) {
      setState(() => _error = 'Please select a photo or video');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });
    try {
      final fields = <String, String>{};
      final caption = _captionCtrl.text.trim();
      if (caption.isNotEmpty) fields['caption'] = caption;

      final mime = _mimeForPath(_pickedFile!.path);
      final multipartFile = await http.MultipartFile.fromPath(
        'file',
        _pickedFile!.path,
        contentType: _parseMediaType(mime),
      );

      await _api.postMultipart('discovery/feed', fields, [multipartFile]);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  /// Simple MediaType parser from a mime string (e.g. "image/jpeg").
  static http_parser.MediaType _parseMediaType(String mime) {
    final parts = mime.split('/');
    return http_parser.MediaType(
      parts.first,
      parts.length > 1 ? parts[1] : 'octet-stream',
    );
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          8,
          16,
          MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Create a post',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontFamily: 'Lora'),
            ),
            const SizedBox(height: 4),
            Text(
              'Share a photo or short video with the community.',
              style: TextStyle(color: surfaces.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _uploading ? null : _pickImage,
                    icon: const Icon(Icons.image_outlined),
                    label: const Text('Photo'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _uploading ? null : _pickVideo,
                    icon: const Icon(Icons.videocam_outlined),
                    label: const Text('Video'),
                  ),
                ),
              ],
            ),
            if (_pickedFile != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: _isVideo
                    ? Container(
                        height: 140,
                        alignment: Alignment.center,
                        color: Theme.of(context).colorScheme.surfaceContainer,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.videocam, size: 36),
                            const SizedBox(height: 4),
                            Text(
                              _pickedFile!.path.split('/').last,
                              style: TextStyle(
                                color: surfaces.textMuted,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      )
                    : Image.file(
                        _pickedFile!,
                        height: 140,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _captionCtrl,
              decoration: const InputDecoration(
                hintText: 'Write a caption (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
              maxLength: 280,
              enabled: !_uploading,
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _uploading ? null : _submit,
              child: _uploading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Post'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapTab extends StatefulWidget {
  const _MapTab();

  @override
  State<_MapTab> createState() => _MapTabState();
}

class _MapTabState extends State<_MapTab> {
  final DiscoveryMapService _service = DiscoveryMapService();
  bool _loading = true;
  List<DiscoveryMapHeatBucket> _heat = const [];
  List<DiscoveryMapCluster> _clusters = const [];
  DiscoveryMapCluster? _selectedCluster;
  List<DiscoveryMapArtistMarker> _artists = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final heat = await _service.getHeat(role: 'artist');
      final clusters = await _service.getClusters(role: 'artist');
      if (!mounted) return;
      setState(() {
        _heat = heat;
        _clusters = clusters;
      });
      if (clusters.isNotEmpty) {
        await _selectCluster(clusters.first);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _selectCluster(DiscoveryMapCluster cluster) async {
    setState(() => _selectedCluster = cluster);
    final artists = await _service.getArtists(cluster: cluster, role: 'artist');
    if (!mounted) return;
    setState(() => _artists = artists);
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (_loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Area Heat (likes by artist home location)'),
                  const SizedBox(height: 8),
                  if (_heat.isEmpty)
                    Text(
                      'No heat data yet.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _heat.take(12).map((h) {
                        return Chip(
                          label: Text(
                            '${h.totalLikes} likes • ${h.artistCount} artists',
                          ),
                          avatar: const Icon(
                            Icons.local_fire_department,
                            size: 16,
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Clusters'),
                  const SizedBox(height: 8),
                  if (_clusters.isEmpty)
                    Text(
                      'No clusters yet.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _clusters.take(20).map((c) {
                        final selected = _selectedCluster?.id == c.id;
                        return ChoiceChip(
                          selected: selected,
                          onSelected: (_) => _selectCluster(c),
                          label: Text(
                            '${c.artistCount} artists • ${c.totalLikes} likes',
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Artists in selected cluster'),
                  const SizedBox(height: 8),
                  if (_artists.isEmpty)
                    Text(
                      'Pick a cluster to load artists.',
                      style: TextStyle(color: surfaces.textSecondary),
                    )
                  else
                    ..._artists
                        .take(25)
                        .map(
                          (artist) => ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            title: Text(artist.displayName ?? 'Artist'),
                            subtitle: Text(
                              '${artist.locationRegion ?? 'Unknown'} • ${artist.likeCount} likes',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                          ),
                        ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
  bool _loading = true;
  List<LibrarySong> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
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

  Future<void> _remove(LibrarySong item) async {
    await _songs.unlike(item.id);
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
          'No songs saved yet. Tap save on a song in radio to add it here.',
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
              title: Text(item.title),
              subtitle: Text(
                item.artistName,
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
