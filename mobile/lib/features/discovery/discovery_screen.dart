import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/models/discover_audio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../pro_radio/widgets/add_to_playlist_sheet.dart';
import 'discover_audio_tab.dart';

class DiscoveryScreen extends StatefulWidget {
  const DiscoveryScreen({
    super.key,
    this.onOpenNavDrawer,
    this.initialTabIndex = 0,
  });

  /// Opens the app's left navigation drawer (shown as a hamburger in the bar).
  final VoidCallback? onOpenNavDrawer;

  /// 0 Swipe · 1 Artists · 2 Library.
  /// Legacy indices (Saved=1, Artists=2, Library=3) are remapped in [initState].
  final int initialTabIndex;

  @override
  State<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends State<DiscoveryScreen>
    with SingleTickerProviderStateMixin {
  final NearbyService _people = NearbyService();
  final TextEditingController _searchCtrl = TextEditingController();
  final GlobalKey<DiscoverAudioTabState> _swipeKey =
      GlobalKey<DiscoverAudioTabState>();
  final GlobalKey<_LibraryTabState> _libraryKey = GlobalKey<_LibraryTabState>();
  final GlobalKey<_LikedArtistsTabState> _likedArtistsKey =
      GlobalKey<_LikedArtistsTabState>();
  late final TabController _tabController;
  Timer? _searchDebounce;

  bool _searchingArtists = false;
  String? _artistSearchError;
  List<Map<String, dynamic>> _artistResults = const [];

  bool get _hasArtistQuery => _searchCtrl.text.trim().length >= 2;

  /// Map old 4-tab indices onto Swipe / Artists / Library.
  static int _normalizeTabIndex(int raw) {
    switch (raw) {
      case 0:
        return 0; // Swipe
      case 1:
        return 2; // legacy Saved → Library
      case 2:
        return 1; // legacy Artists → Artists
      case 3:
        return 2; // legacy Library → Library
      default:
        return raw.clamp(0, 2);
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 3,
      vsync: this,
      initialIndex: _normalizeTabIndex(widget.initialTabIndex),
    );
    _searchCtrl.addListener(_onSearchTextChanged);
    _tabController.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    if (_tabController.index == 1) {
      unawaited(_likedArtistsKey.currentState?.reload() ?? Future<void>.value());
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchCtrl.removeListener(_onSearchTextChanged);
    _tabController.removeListener(_onTabChanged);
    _searchCtrl.dispose();
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
        await _likedArtistsKey.currentState?.reload();
        return;
      case 2:
        await _libraryKey.currentState?.reload();
        return;
      default:
        return;
    }
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
                  unawaited(
                    _libraryKey.currentState?.reload() ?? Future<void>.value(),
                  );
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
                  hintText: 'Search all artists by name…',
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
                        _LikedArtistsTab(key: _likedArtistsKey),
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

// Discover "Saved" tab removed — swipe likes live under Library → Liked.

class _LikedArtistsTab extends StatefulWidget {
  const _LikedArtistsTab({super.key});

  @override
  State<_LikedArtistsTab> createState() => _LikedArtistsTabState();
}

class _LikedArtistsTabState extends State<_LikedArtistsTab> {
  final DiscoverAudioService _discover = DiscoverAudioService();
  final NearbyService _people = NearbyService();
  bool _loadingLiked = true;
  bool _loadingMore = true;
  String? _likedError;
  String? _moreError;
  List<DiscoverLikedArtist> _liked = const [];
  List<Map<String, dynamic>> _moreArtists = const [];

  @override
  void initState() {
    super.initState();
    unawaited(reload());
  }

  Future<void> reload() async {
    setState(() {
      _loadingLiked = true;
      _loadingMore = true;
      _likedError = null;
      _moreError = null;
    });
    await Future.wait([_loadLiked(), _loadMoreArtists()]);
  }

  Future<void> _loadLiked() async {
    try {
      final items = await _discover.getLikedArtists(limit: 100);
      if (!mounted) return;
      setState(() => _liked = items);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _likedError =
            "Couldn't load artists you've liked. Pull to refresh.",
      );
    } finally {
      if (mounted) setState(() => _loadingLiked = false);
    }
  }

  Future<void> _loadMoreArtists() async {
    try {
      final res = await _people.listPeople(
        role: 'artist',
        limit: 40,
        offset: 0,
      );
      final raw = (res['items'] is List) ? res['items'] as List : const [];
      final likedIds = _liked.map((a) => a.userId).toSet();
      // Prefer excluding already-liked when that list is already in; if liked
      // hasn't finished yet, filter again after both settle in build.
      final items = raw
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .where((m) {
            final id = (m['userId'] ?? m['user_id'] ?? m['id'] ?? '')
                .toString();
            return id.isNotEmpty && !likedIds.contains(id);
          })
          .toList();
      if (!mounted) return;
      setState(() => _moreArtists = items);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _moreError = "Couldn't load more artists. Pull to refresh.",
      );
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _openLiked(DiscoverLikedArtist artist) {
    if (artist.userId.isEmpty) return;
    unawaited(
      AppRoutes.openArtistProfile(context, artistId: artist.userId),
    );
  }

  void _openPerson(Map<String, dynamic> person) {
    final id = (person['userId'] ?? person['user_id'] ?? person['id'] ?? '')
        .toString()
        .trim();
    if (id.isEmpty) return;
    unawaited(AppRoutes.openArtistProfile(context, artistId: id));
  }

  List<Map<String, dynamic>> get _browseArtists {
    final likedIds = _liked.map((a) => a.userId).toSet();
    return _moreArtists.where((m) {
      final id = (m['userId'] ?? m['user_id'] ?? m['id'] ?? '').toString();
      return id.isNotEmpty && !likedIds.contains(id);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final browse = _browseArtists;
    final initialLoading =
        (_loadingLiked && _liked.isEmpty) && (_loadingMore && browse.isEmpty);

    if (initialLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 32),
        children: [
          _sectionLabel(surfaces, 'Artists you’ve liked'),
          const SizedBox(height: 8),
          if (_loadingLiked && _liked.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (_likedError != null && _liked.isEmpty)
            _messageCard(
              surfaces,
              _likedError!,
              actionLabel: 'Retry',
              onAction: _loadLiked,
            )
          else if (_liked.isEmpty)
            _messageCard(
              surfaces,
              'None yet — swipe right on Discover songs, or browse more artists below.',
            )
          else
            ..._liked.map((artist) {
              // Null displayName used to take the false branch of
              // `(name ?? 'Artist').isEmpty ? … : name!` and crash the tab.
              final rawName = (artist.displayName ?? '').trim();
              final name = rawName.isEmpty ? 'Artist' : rawName;
              final handle = (artist.username ?? '').trim();
              final headline = (artist.headline ?? '').trim();
              final meta = [
                if (handle.isNotEmpty) '@$handle',
                if (headline.isNotEmpty) headline,
              ].join(' · ');
              final likedLine = artist.likedSongCount > 0
                  ? '${artist.likedSongCount} liked song${artist.likedSongCount == 1 ? '' : 's'}'
                  : null;
              final avatar = (artist.avatarUrl ?? '').trim();
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    onTap: () => _openLiked(artist),
                    leading: CircleAvatar(
                      backgroundColor: scheme.surfaceContainerHighest,
                      backgroundImage:
                          avatar.isNotEmpty ? NetworkImage(avatar) : null,
                      child: avatar.isEmpty
                          ? const Icon(Icons.person_outline)
                          : null,
                    ),
                    title: Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (meta.isNotEmpty)
                          Text(
                            meta,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: surfaces.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        if (likedLine != null)
                          Text(
                            likedLine,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: surfaces.textMuted,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                    isThreeLine: meta.isNotEmpty && likedLine != null,
                    trailing: const Icon(Icons.chevron_right),
                  ),
                ),
              );
            }),
          const SizedBox(height: 16),
          _sectionLabel(surfaces, 'More artists'),
          const SizedBox(height: 4),
          Text(
            'Search above to find anyone by name, or browse here.',
            style: TextStyle(color: surfaces.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 8),
          if (_loadingMore && browse.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (_moreError != null && browse.isEmpty)
            _messageCard(
              surfaces,
              _moreError!,
              actionLabel: 'Retry',
              onAction: _loadMoreArtists,
            )
          else if (browse.isEmpty)
            _messageCard(
              surfaces,
              'No other discoverable artists right now. Try searching by name.',
            )
          else ...[
            ...browse.map((person) {
              final name =
                  (person['displayName'] ??
                          person['display_name'] ??
                          'Artist')
                      .toString()
                      .trim();
              final handle =
                  (person['username'] ?? '').toString().trim();
              final headline =
                  (person['headline'] ?? '').toString().trim();
              final avatar =
                  (person['avatarUrl'] ?? person['avatar_url'] ?? '')
                      .toString();
              final meta = [
                if (handle.isNotEmpty) '@$handle',
                if (headline.isNotEmpty) headline,
              ].join(' · ');
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Card(
                  child: ListTile(
                    onTap: () => _openPerson(person),
                    leading: CircleAvatar(
                      backgroundColor: scheme.surfaceContainerHighest,
                      backgroundImage:
                          avatar.isNotEmpty ? NetworkImage(avatar) : null,
                      child: avatar.isEmpty
                          ? const Icon(Icons.person_outline)
                          : null,
                    ),
                    title: Text(
                      name.isEmpty ? 'Artist' : name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: meta.isEmpty
                        ? null
                        : Text(
                            meta,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                    trailing: const Icon(Icons.chevron_right),
                  ),
                ),
              );
            }),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Text(
                'That’s everyone for now. Use search to find more.',
                textAlign: TextAlign.center,
                style: TextStyle(color: surfaces.textMuted, fontSize: 12),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _sectionLabel(NetworxSurfaces surfaces, String text) {
    return Text(
      text,
      style: TextStyle(
        color: surfaces.textSecondary,
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
      ),
    );
  }

  Widget _messageCard(
    NetworxSurfaces surfaces,
    String message, {
    String? actionLabel,
    Future<void> Function()? onAction,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: surfaces.textSecondary, fontSize: 13),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 10),
              Center(
                child: TextButton.icon(
                  onPressed: () => unawaited(onAction()),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: Text(actionLabel),
                ),
              ),
            ],
          ],
        ),
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
  final AudioPlayer _player = AudioPlayerService().player;
  StreamSubscription<PlayerState>? _playerStateSub;

  // favorites = ⭐ · liked/disliked = Discover swipes · music = purchases.
  String _section = 'favorites';
  bool _favoritesLoading = true;
  List<LibrarySong> _favorites = const [];
  String? _busyFavoriteId;

  bool _historyLoading = true;
  List<DiscoverAudioHistoryItem> _liked = const [];
  List<DiscoverAudioHistoryItem> _disliked = const [];
  String? _busyHistoryId;

  bool _purchasesLoading = true;
  List<PurchasedSong> _purchases = const [];
  String? _busyPurchaseId;

  /// Song currently loaded from this Library tab (clip or purchase).
  String? _activeSongId;
  bool _isPlaying = false;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    _loadHistory();
    _loadPurchases();
    _playerStateSub = _player.playerStateStream.listen((s) {
      if (!mounted) return;
      final activeId = _mediaSongId;
      if (activeId == null) {
        if (_isPlaying || _activeSongId != null) {
          setState(() {
            _isPlaying = false;
            _activeSongId = null;
          });
        }
        return;
      }
      final handler = AudioPlayerService.handler;
      final audible = s.playing && !handler.userPaused;
      if (_activeSongId != activeId || _isPlaying != audible) {
        setState(() {
          _activeSongId = activeId;
          _isPlaying = audible;
        });
      }
    });
  }

  @override
  void dispose() {
    unawaited(_playerStateSub?.cancel() ?? Future<void>.value());
    super.dispose();
  }

  String? get _mediaSongId {
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return null;
    final source = tag.extras?['source']?.toString();
    // Library plays clips as sample and purchases as discography.
    if (source != 'sample' && source != 'discography') return null;
    return tag.id;
  }

  bool _isAudiblyPlaying(String songId) =>
      _activeSongId == songId && _isPlaying;

  Future<void> _toggleOrPlay({
    required String songId,
    required Future<void> Function() startPlayback,
  }) async {
    final same = _mediaSongId == songId;
    final handler = AudioPlayerService.handler;
    if (same) {
      if (_player.playing && !handler.userPaused && _player.volume > 0) {
        await _player.pause();
        if (mounted) setState(() => _isPlaying = false);
      } else {
        await handler.setUserPaused(false);
        await handler.applyOutputVolume();
        await _player.play();
        if (mounted) {
          setState(() {
            _activeSongId = songId;
            _isPlaying = true;
          });
        }
      }
      return;
    }
    await startPlayback();
  }

  Future<void> reload() async {
    await Future.wait([
      _loadFavorites(),
      _loadHistory(),
      _loadPurchases(),
    ]);
  }

  Future<void> _loadFavorites() async {
    setState(() => _favoritesLoading = true);
    try {
      final items = await _songs.getFavorites(limit: 200);
      if (!mounted) return;
      setState(() => _favorites = items);
    } catch (_) {
      // Best-effort.
    } finally {
      if (mounted) setState(() => _favoritesLoading = false);
    }
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
      await _toggleOrPlay(
        songId: item.songId,
        startPlayback: () async {
          await _player.setAudioSource(
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
          await AudioPlayerService.handler.setUserPaused(false);
          await AudioPlayerService.handler.applyOutputVolume();
          await _player.play();
          if (mounted) {
            setState(() {
              _activeSongId = item.songId;
              _isPlaying = true;
            });
          }
        },
      );
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
      await _toggleOrPlay(
        songId: item.id,
        startPlayback: () async {
          final url = await _songs.getStreamUrl(item.id);
          if (url == null || url.isEmpty) {
            throw Exception('Stream unavailable.');
          }
          // Tag the source so the bottom bar shows this track with a seek slider
          // (purchased = full entitled stream, scrubbing allowed).
          await _player.setAudioSource(
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
          await AudioPlayerService.handler.setUserPaused(false);
          await AudioPlayerService.handler.applyOutputVolume();
          await _player.play();
          if (mounted) {
            setState(() {
              _activeSongId = item.id;
              _isPlaying = true;
            });
          }
        },
      );
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
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'favorites',
                  label: Text('Favorites'),
                  icon: Icon(Icons.star_outline),
                ),
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
        ),
        Expanded(
          child: switch (_section) {
            'favorites' => _buildFavoritesSection(surfaces),
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

  Widget _buildFavoritesSection(NetworxSurfaces surfaces) {
    if (_favoritesLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_favorites.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadFavorites,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 48),
            Text(
              'No favorites yet. Tap ⭐ next to 🔥 on the radio to star a song for alerts.',
              textAlign: TextAlign.center,
              style: TextStyle(color: surfaces.textSecondary),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadFavorites,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _favorites.length,
        itemBuilder: (context, i) {
          final fav = _favorites[i];
          final artwork = (fav.artworkUrl ?? '').trim();
          final busy = _busyFavoriteId == fav.id;
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              onTap: () => _openArtistSong(
                artistId: fav.artistId,
                songId: fav.id,
              ),
              leading: ClipRRect(
                borderRadius: BorderRadius.circular(DimensionTokens.tileRadius),
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: artwork.isNotEmpty
                      ? Image.network(
                          artwork,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stackTrace) =>
                              const ColoredBox(
                            color: Colors.black26,
                            child: Icon(Icons.music_note),
                          ),
                        )
                      : const ColoredBox(
                          color: Colors.black26,
                          child: Icon(Icons.music_note),
                        ),
                ),
              ),
              title: Text(fav.title),
              subtitle: Text(fav.artistName),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AddToPlaylistButton(
                    songId: fav.id,
                    songTitle: fav.title,
                  ),
                  if (busy)
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    IconButton(
                      tooltip: 'Remove favorite',
                      onPressed: () => _removeFavorite(fav),
                      icon: const Icon(
                        Icons.star,
                        color: Color(0xFFFFC107),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _removeFavorite(LibrarySong fav) async {
    setState(() => _busyFavoriteId = fav.id);
    try {
      await _songs.unfavorite(fav.id);
      if (!mounted) return;
      setState(() {
        _favorites = _favorites.where((f) => f.id != fav.id).toList();
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not remove favorite: $e')),
      );
    } finally {
      if (mounted) setState(() => _busyFavoriteId = null);
    }
  }

  void _openArtistSong({required String artistId, required String songId}) {
    final id = artistId.trim();
    if (id.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Artist profile unavailable for this song.')),
      );
      return;
    }
    unawaited(
      AppRoutes.openArtistProfile(
        context,
        artistId: id,
        songId: songId,
      ),
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
          final playing = _isAudiblyPlaying(item.songId);
          final art = item.backgroundUrl;
          return Card(
            child: ListTile(
              onTap: () => _openArtistSong(
                artistId: item.artistId,
                songId: item.songId,
              ),
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
                  AddToPlaylistButton(
                    songId: item.songId,
                    songTitle: item.title,
                  ),
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
                    tooltip: playing ? 'Pause clip' : 'Play clip',
                    onPressed: busy ? null : () => _playDiscoverClip(item),
                    icon: Icon(playing ? Icons.pause : Icons.play_arrow),
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
          final playing = _isAudiblyPlaying(item.id);
          return Card(
            child: ListTile(
              onTap: () => _openArtistSong(
                artistId: item.artistId,
                songId: item.id,
              ),
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
                  AddToPlaylistButton(
                    songId: item.id,
                    songTitle: item.title,
                  ),
                  IconButton(
                    tooltip: playing ? 'Pause' : 'Play',
                    icon: busy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child:
                                CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(playing ? Icons.pause : Icons.play_arrow),
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
