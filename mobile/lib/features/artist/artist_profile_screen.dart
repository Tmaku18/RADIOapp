import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:audio_service/audio_service.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/song.dart';
import '../../core/services/api_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/song_purchase_flow.dart';
import '../../core/services/livestream_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/services/pro_radio_queue_service.dart';
import '../../core/services/users_service.dart';
import '../../core/models/pro_radio_models.dart';
import '../../features/pro_radio/widgets/pro_radio_paywall_sheet.dart';
import '../../features/pro_radio/widgets/add_to_playlist_sheet.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';

class ArtistProfileScreen extends StatefulWidget {
  final String artistId;

  /// When set (e.g. from Liked / Favorites / Library), scroll the discography
  /// to this song after load so Buy / sample / other tracks are easy to reach.
  final String? focusSongId;

  const ArtistProfileScreen({
    super.key,
    required this.artistId,
    this.focusSongId,
  });

  @override
  State<ArtistProfileScreen> createState() => _ArtistProfileScreenState();
}

class _ArtistProfileScreenState extends State<ArtistProfileScreen> {
  final SongsService _songs = SongsService();
  final AudioPlayer _player = AudioPlayerService().player;
  final LivestreamService _live = LivestreamService();
  final UsersService _users = UsersService();
  final ProNetworxService _pro = ProNetworxService();
  final ProRadioQueueService _proRadioQueue = ProRadioQueueService.instance;
  final ScrollController _scrollController = ScrollController();

  final Map<String, GlobalKey> _songKeys = <String, GlobalKey>{};

  bool _loading = true;
  String? _error;
  app_user.User? _artist;
  String? _heroImageUrl;
  List<Song> _tracks = const [];
  String? _activeSongId;
  bool _isPlaying = false;
  final Map<String, bool> _likedBySongId = <String, bool>{};
  final Map<String, bool> _favoritedBySongId = <String, bool>{};
  final Set<String> _recordedListenForSongIds = <String>{};
  final Set<String> _ownedSongIds = <String>{};
  String? _buyingId;
  String? _downloadingId;
  Timer? _listenTimer;
  Timer? _sampleStopTimer;
  Timer? _focusClearTimer;
  Map<String, dynamic>? _liveSession;
  bool _liveActionLoading = false;
  bool _isOwnerProfile = false;
  bool _following = false;
  bool _favorited = false;
  bool _followLoading = false;
  bool _favoriteLoading = false;
  String? _highlightedSongId;
  bool _didScrollToFocus = false;

  @override
  void initState() {
    super.initState();
    _load();
    _player.playerStateStream.listen((s) {
      if (!mounted) return;
      if (_isProRadioActive) {
        final id = _proRadioQueue.current?.songId;
        if (id != null && id != _activeSongId) {
          setState(() => _activeSongId = id);
        }
        final handler = AudioPlayerService.handler;
        final audible = s.playing && !handler.userPaused;
        if (_isPlaying != audible) setState(() => _isPlaying = audible);
        return;
      }
      if (!_isOurSourceActive) {
        if (_isPlaying) setState(() => _isPlaying = false);
        return;
      }
      final handler = AudioPlayerService.handler;
      final audible = s.playing && !handler.userPaused;
      if (_isPlaying != audible) setState(() => _isPlaying = audible);
    });
    _player.processingStateStream.listen((st) {
      if (!mounted) return;
      if (st == ProcessingState.completed &&
          _isOurSourceActive &&
          !_isProRadioActive) {
        _playNext();
      }
    });
  }

  /// True when the shared player is currently on this profile's song/sample.
  bool get _isOurSourceActive {
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    final source = tag.extras?['source']?.toString();
    if (source != 'discography' && source != 'sample') return false;
    final id = _activeSongId;
    if (id == null) return false;
    return tag.id == id;
  }

  bool get _isProRadioActive {
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    return tag.extras?['source']?.toString() == 'pro_radio';
  }

  Future<List<Song>> _loadArtistProfileTracks() async {
    final api = ApiService();
    final raw = await api.get('users/${widget.artistId}/artist-profile');
    if (raw is! Map) return const [];
    final list = raw['librarySongs'];
    if (list is! List) return const [];
    return list
        .whereType<Map>()
        .map(
          (e) => Song.fromJson(e.map((k, v) => MapEntry(k.toString(), v))),
        )
        .toList();
  }

  @override
  void dispose() {
    _listenTimer?.cancel();
    _sampleStopTimer?.cancel();
    _focusClearTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  GlobalKey _keyForSong(String songId) =>
      _songKeys.putIfAbsent(songId, GlobalKey.new);

  Future<void> _scrollToFocusedSong() async {
    final focusId = widget.focusSongId?.trim();
    if (focusId == null || focusId.isEmpty || _didScrollToFocus) return;
    if (!_tracks.any((t) => t.id == focusId)) return;
    _didScrollToFocus = true;
    if (mounted) setState(() => _highlightedSongId = focusId);

    // Wait for the list to lay out before ensureVisible.
    await Future<void>.delayed(const Duration(milliseconds: 80));
    if (!mounted) return;
    final ctx = _keyForSong(focusId).currentContext;
    if (ctx != null && ctx.mounted) {
      await Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        alignment: 0.15,
      );
    }
    if (!mounted) return;
    _focusClearTimer?.cancel();
    _focusClearTimer = Timer(const Duration(seconds: 4), () {
      if (!mounted) return;
      setState(() => _highlightedSongId = null);
    });
  }

  bool _ownsSong(Song s) => _isOwnerProfile || _ownedSongIds.contains(s.id);

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ApiService();
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      final isOwner = me != null && me.id == widget.artistId;
      final artistRaw = await api.get('users/${widget.artistId}');
      final artist = (artistRaw is Map<String, dynamic>)
          ? app_user.User.fromJson(artistRaw)
          : null;
      final tracks = isOwner
          ? await _songs.getMine()
          : await _loadArtistProfileTracks();
      if (!mounted) return;
      setState(() {
        _isOwnerProfile = isOwner;
        _artist = artist;
        _tracks = tracks;
      });
      unawaited(_loadCover());
      if (!isOwner && me != null) {
        await _loadPurchases();
        await _loadFollowFavoriteState();
      } else if (mounted) {
        setState(() {
          _following = false;
          _favorited = false;
        });
      }
      await _loadLikes();
      await _loadLiveStatus();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          unawaited(_scrollToFocusedSong());
        });
      }
    }
  }

  Future<void> _loadCover() async {
    try {
      final pro = await _pro.getProfileByUserId(widget.artistId);
      final url =
          (pro['heroImageUrl'] ?? pro['hero_image_url'] ?? '').toString().trim();
      if (!mounted) return;
      setState(() => _heroImageUrl = url.isEmpty ? null : url);
    } catch (_) {
      // Cover is optional on public artist profiles.
    }
  }

  Future<void> _loadFollowFavoriteState() async {
    try {
      final results = await Future.wait([
        _users.isFollowing(widget.artistId),
        _users.isFavorited(widget.artistId),
      ]);
      if (!mounted) return;
      setState(() {
        _following = results[0];
        _favorited = results[1];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _following = false;
        _favorited = false;
      });
    }
  }

  Future<void> _toggleFollow() async {
    if (_isOwnerProfile || _followLoading) return;
    final next = !_following;
    setState(() {
      _followLoading = true;
      _following = next;
      if (!next) _favorited = false;
    });
    try {
      if (next) {
        await _users.follow(widget.artistId);
      } else {
        await _users.unfollow(widget.artistId);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _following = !next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update follow: $e')),
      );
    } finally {
      if (mounted) setState(() => _followLoading = false);
    }
  }

  Future<void> _toggleFavorite() async {
    if (_isOwnerProfile || _favoriteLoading) return;
    final next = !_favorited;
    setState(() {
      _favoriteLoading = true;
      _favorited = next;
      if (next) _following = true;
    });
    try {
      if (next) {
        await _users.favorite(widget.artistId);
      } else {
        await _users.unfavorite(widget.artistId);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _favorited = !next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update favorite: $e')),
      );
    } finally {
      if (mounted) setState(() => _favoriteLoading = false);
    }
  }

  Future<void> _loadPurchases() async {
    try {
      final purchases = await _songs.getPurchases();
      if (!mounted) return;
      setState(() {
        _ownedSongIds
          ..clear()
          ..addAll(purchases.map((p) => p.id));
      });
    } catch (_) {
      // Best-effort; default to sample-only.
    }
  }

  Future<void> _loadLiveStatus() async {
    try {
      final data = await _live.getStatus(widget.artistId);
      if (!mounted) return;
      setState(() {
        _liveSession = data?['session'] is Map<String, dynamic>
            ? data!['session'] as Map<String, dynamic>
            : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _liveSession = null);
    }
  }

  bool get _isLiveNow {
    final status = _liveSession?['status']?.toString();
    return status == 'starting' || status == 'live';
  }

  Future<void> _startLive() async {
    setState(() => _liveActionLoading = true);
    try {
      await Navigator.pushNamed(context, AppRoutes.goLive);
      await _loadLiveStatus();
    } finally {
      if (mounted) setState(() => _liveActionLoading = false);
    }
  }

  Future<void> _loadLikes() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final me = await auth.getUserProfile();
    if (!mounted) return;
    if (me == null) return;
    // Fetch like / favorite status best-effort (one-by-one, can be optimized later).
    for (final s in _tracks) {
      try {
        final results = await Future.wait([
          _songs.getLikeStatus(s.id),
          _songs.getFavoriteStatus(s.id),
        ]);
        if (!mounted) return;
        setState(() {
          _likedBySongId[s.id] = results[0];
          _favoritedBySongId[s.id] = results[1];
        });
      } catch (_) {
        // ignore
      }
    }
  }

  int get _activeIndex {
    final id = _activeSongId;
    if (id == null) return -1;
    return _tracks.indexWhere((t) => t.id == id);
  }

  bool _canStreamFull(Song s) {
    if (s.isBeat) return false;
    return _ownsSong(s) || s.streamEntitled;
  }

  Future<void> _playViaProRadio(Song s, {bool toggle = true}) async {
    final same = _proRadioQueue.current?.songId == s.id && _isProRadioActive;
    if (same && toggle) {
      await _toggleProRadioPlayPause();
      return;
    }

    _listenTimer?.cancel();
    _sampleStopTimer?.cancel();
    if (mounted) {
      setState(() {
        _activeSongId = s.id;
        _isPlaying = true;
      });
    }

    final items = <ProRadioQueueItem>[];
    for (final t in _tracks) {
      if (t.isBeat || !_canStreamFull(t)) continue;
      final url = t.streamEntitled && t.audioUrl.isNotEmpty
          ? t.audioUrl
          : await _songs.getStreamUrl(t.id);
      if (url == null || url.isEmpty) continue;
      items.add(
        ProRadioQueueItem(
          songId: t.id,
          title: t.title,
          artistName: t.artistName,
          artworkUrl: t.artworkUrl,
          audioUrl: url,
        ),
      );
    }
    if (items.isEmpty) {
      if (!mounted) return;
      setState(() {
        _activeSongId = null;
        _isPlaying = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start Pro-Radio playback.')),
      );
      return;
    }
    final startAt = items.indexWhere((e) => e.songId == s.id);
    await _proRadioQueue.playItems(items, startAt: startAt < 0 ? 0 : startAt);
    _scheduleListenRecord(s.id);
  }

  Future<void> _toggleProRadioPlayPause() async {
    final handler = AudioPlayerService.handler;
    if (_player.playing && !handler.userPaused && _player.volume > 0) {
      await _player.pause();
    } else {
      await handler.setUserPaused(false);
      await handler.applyOutputVolume();
      await _player.play();
    }
    if (mounted) {
      setState(
        () => _isPlaying = _player.playing && !handler.userPaused,
      );
    }
  }

  Future<void> _playSong(Song s, {bool toggle = true}) async {
    final owns = _ownsSong(s);
    final isBeat = s.isBeat;

    if (!isBeat && s.proRadioEligible && !s.streamEntitled && !owns) {
      await ProRadioPaywallSheet.show(context);
      return;
    }

    if (!isBeat && _canStreamFull(s)) {
      await _playViaProRadio(s, toggle: toggle);
      return;
    }

    final same = _activeSongId == s.id && _isOurSourceActive;
    if (same && toggle) {
      final handler = AudioPlayerService.handler;
      if (_player.playing && !handler.userPaused && _player.volume > 0) {
        // Hard-pause discography (soft-pause would keep advancing silently).
        await _player.pause();
      } else {
        await handler.setUserPaused(false);
        await handler.applyOutputVolume();
        await _player.play();
      }
      if (mounted) {
        setState(() => _isPlaying = _player.playing && !handler.userPaused);
      }
      return;
    }

    _listenTimer?.cancel();
    _sampleStopTimer?.cancel();
    if (mounted) {
      setState(() {
        _activeSongId = s.id;
        _isPlaying = true;
      });
    }

    String? playUrl;
    if (owns || isBeat) {
      playUrl = (await _songs.getStreamUrl(s.id)) ?? s.audioUrl;
    } else {
      playUrl = (s.sampleUrl ?? '').isNotEmpty ? s.sampleUrl : s.audioUrl;
    }
    if (playUrl == null || playUrl.isEmpty) {
      if (!mounted) return;
      setState(() {
        _activeSongId = null;
        _isPlaying = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isBeat
                ? 'Full beat preview not available yet.'
                : 'Preview not available yet.',
          ),
        ),
      );
      return;
    }

    final usingFallbackSample = !owns &&
        !isBeat &&
        ((s.sampleUrl ?? '').isEmpty) &&
        s.audioUrl.isNotEmpty;

    try {
      await AudioPlayerService().loadSource(
        AudioSource.uri(
          Uri.parse(playUrl),
          tag: MediaItem(
            id: s.id,
            title: s.title,
            artist: s.artistName,
            artUri: BrandAssets.mediaArtUri(s.artworkUrl),
            extras: {
              'source': owns
                  ? 'discography'
                  : (isBeat ? 'beat_preview' : 'sample'),
              // Non-owners must not scrub song samples (30s timer). Beats allow
              // full listen-before-buy so seeking is OK for marketplace previews.
              'noSeek': !owns && !isBeat,
            },
          ),
        ),
        initialPosition: usingFallbackSample && s.sampleStartSeconds > 0
            ? Duration(milliseconds: (s.sampleStartSeconds * 1000).round())
            : null,
      );
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      if (msg.contains('Loading interrupted')) return;
      setState(() {
        _activeSongId = null;
        _isPlaying = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start playback.')),
      );
      return;
    }

    // When no rendered sample exists, stop after 30s so non-buyers can't hear
    // the full song (beats are intentionally full-length previews).
    if (usingFallbackSample) {
      _sampleStopTimer = Timer(const Duration(seconds: 30), () async {
        try {
          await _player.pause();
        } catch (_) {}
      });
    }

    // Clear radio soft-mute so the first tap is audible, then play.
    final handler = AudioPlayerService.handler;
    await handler.setUserPaused(false);
    await handler.applyOutputVolume();
    await _player.play();
    if (!mounted) return;
    setState(() {
      _activeSongId = s.id;
      _isPlaying = true;
    });
    if (owns) _scheduleListenRecord(s.id);
  }

  Future<void> _buySong(Song s) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final me = await auth.getUserProfile();
    if (!mounted) return;
    if (me == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Log in to buy songs.')),
      );
      return;
    }
    setState(() => _buyingId = s.id);
    try {
      final outcome = await SongPurchaseFlow.buy(
        songId: s.id,
        priceCents: s.priceCents,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(outcome.message)));
      if (outcome.unlocked) await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Purchase failed: $e')));
    } finally {
      if (mounted) setState(() => _buyingId = null);
    }
  }

  Future<void> _downloadSong(Song s) async {
    setState(() => _downloadingId = s.id);
    try {
      final url = await _songs.getDownloadUrl(s.id);
      if (url == null || url.isEmpty) {
        throw Exception('Download link unavailable.');
      }
      await _openExternalUrl(url);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Download failed: $e')));
    } finally {
      if (mounted) setState(() => _downloadingId = null);
    }
  }

  String _formatPrice(int cents) {
    final dollars = cents / 100.0;
    return '\$${dollars.toStringAsFixed(2)}';
  }

  void _scheduleListenRecord(String songId) {
    if (_recordedListenForSongIds.contains(songId)) return;
    _listenTimer?.cancel();
    _listenTimer = Timer(const Duration(seconds: 30), () async {
      try {
        await _songs.recordProfileListen(songId);
        _recordedListenForSongIds.add(songId);
      } catch (_) {
        // Don't break playback UX.
      }
    });
  }

  Future<void> _playNext() async {
    if (_isProRadioActive) {
      await _proRadioQueue.skipNext();
      if (mounted) {
        setState(() => _activeSongId = _proRadioQueue.current?.songId);
      }
      return;
    }
    // Only auto-advance while this profile still owns the shared player.
    if (_activeSongId == null) return;
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is MediaItem) {
      final source = tag.extras?['source']?.toString();
      if (source != 'discography' && source != 'sample') return;
    }
    final idx = _activeIndex;
    if (idx < 0) return;
    final next = idx + 1;
    if (next >= _tracks.length) {
      if (mounted) setState(() => _isPlaying = false);
      return;
    }
    await _playSong(_tracks[next], toggle: false);
  }

  Future<void> _playPrev() async {
    if (_isProRadioActive) {
      await _proRadioQueue.skipPrevious();
      if (mounted) {
        setState(() => _activeSongId = _proRadioQueue.current?.songId);
      }
      return;
    }
    final idx = _activeIndex;
    if (idx <= 0) return;
    await _playSong(_tracks[idx - 1], toggle: false);
  }

  Future<void> _toggleLike(Song s) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final me = await auth.getUserProfile();
    if (!mounted) return;
    if (me == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Log in to like songs.')));
      return;
    }
    final current = _likedBySongId[s.id] == true;
    setState(() => _likedBySongId[s.id] = !current);
    try {
      HapticFeedback.selectionClick();
      if (current) {
        await _songs.unlike(s.id);
      } else {
        await _songs.like(s.id);
      }
    } catch (e) {
      // Revert on failure.
      if (!mounted) return;
      setState(() => _likedBySongId[s.id] = current);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Like failed: $e')));
    }
  }

  Future<void> _toggleSongFavorite(Song s) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    final me = await auth.getUserProfile();
    if (!mounted) return;
    if (me == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Log in to favorite songs.')),
      );
      return;
    }
    final current = _favoritedBySongId[s.id] == true;
    setState(() => _favoritedBySongId[s.id] = !current);
    try {
      HapticFeedback.selectionClick();
      if (current) {
        await _songs.unfavorite(s.id);
      } else {
        await _songs.favorite(s.id);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _favoritedBySongId[s.id] = current);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Favorite failed: $e')));
    }
  }

  String _likeTimeAgo(DateTime? dt) {
    if (dt == null) return 'Recently';
    final local = dt.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${local.month}/${local.day}/${local.year}';
  }

  Future<void> _openExternalUrl(String rawUrl) async {
    final raw = rawUrl.trim();
    if (raw.isEmpty) return;
    final uri = Uri.tryParse(raw.startsWith('http') ? raw : 'https://$raw');
    if (uri == null || !await canLaunchUrl(uri)) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  List<Widget> _buildSocialLinks(app_user.User? artist) {
    if (artist == null) return const [];
    final links = <({String label, String? value})>[
      (label: 'Instagram', value: artist.instagramUrl),
      (label: 'X', value: artist.twitterUrl),
      (label: 'TikTok', value: artist.tiktokUrl),
      (label: 'YouTube', value: artist.youtubeUrl),
      (label: 'SoundCloud', value: artist.soundcloudUrl),
      (label: 'Spotify', value: artist.spotifyUrl),
      (label: 'Apple Music', value: artist.appleMusicUrl),
      (label: 'Facebook', value: artist.facebookUrl),
      (label: 'Snapchat', value: artist.snapchatUrl),
      (label: 'Website', value: artist.websiteUrl),
    ].where((e) => (e.value ?? '').trim().isNotEmpty).toList();

    return links
        .map(
          (link) => link.label == 'Instagram'
              ? TextButton.icon(
                  onPressed: () => _openExternalUrl(link.value!),
                  icon: _instagramGlyph(context),
                  label: Text(link.label),
                )
              : TextButton(
                  onPressed: () => _openExternalUrl(link.value!),
                  child: Text(link.label),
                ),
        )
        .toList();
  }

  /// Official IG glyph: white on dark backgrounds, black on light ones.
  Widget _instagramGlyph(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      BrandAssets.instagramGlyphWhiteAsset,
      width: 16,
      height: 16,
      color: dark ? Colors.white : Colors.black,
    );
  }

  Future<void> _showLikesSheet(Song song) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        final surfaces = context.networxSurfaces;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: FutureBuilder<SongLikesResponse>(
              future: _songs.getLikes(song.id),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const SizedBox(
                    height: 220,
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snap.hasError) {
                  return SizedBox(
                    height: 220,
                    child: Center(
                      child: Text(
                        'Could not load likes.',
                        style: TextStyle(color: surfaces.textSecondary),
                      ),
                    ),
                  );
                }
                final data = snap.data ??
                    const SongLikesResponse(totalLikes: 0, likes: <SongLikeUser>[]);
                return SizedBox(
                  height: MediaQuery.of(context).size.height * 0.6,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Likes for "${song.title}" (${data.totalLikes})',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      if (data.likes.isEmpty)
                        Expanded(
                          child: Center(
                            child: Text(
                              'No likes yet.',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            itemCount: data.likes.length,
                            separatorBuilder: (context, index) =>
                                const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final like = data.likes[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundImage:
                                      (like.avatarUrl ?? '').trim().isNotEmpty
                                      ? CachedNetworkImageProvider(like.avatarUrl!)
                                      : null,
                                  child: (like.avatarUrl ?? '').trim().isEmpty
                                      ? const Icon(Icons.person_outline)
                                      : null,
                                ),
                                title: Text(like.displayName?.trim().isNotEmpty == true
                                    ? like.displayName!
                                    : 'Unknown user'),
                                subtitle: Text(_likeTimeAgo(like.likedAt)),
                                onTap: like.userId.trim().isEmpty
                                    ? null
                                    : () {
                                        Navigator.pop(context);
                                        Navigator.pushNamed(
                                          this.context,
                                          AppRoutes.artistProfile,
                                          arguments: like.userId,
                                        );
                                      },
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Artist')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              _error!,
              style: TextStyle(color: surfaces.textSecondary),
            ),
          ),
        ),
      );
    }

    final a = _artist;
    final displayName = a?.displayName?.trim().isNotEmpty == true
        ? a!.displayName!
        : 'Artist';
    final headerArt = (a?.avatarUrl?.isNotEmpty == true) ? a!.avatarUrl! : null;
    final auth = Provider.of<AuthService>(context, listen: false);
    final isLoggedIn = auth.currentUser != null;

    Widget glass({required Widget child}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: surfaces.glassBlur,
            sigmaY: surfaces.glassBlur,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(
                color: Colors.white.withValues(
                  alpha: surfaces.glassBorderOpacity,
                ),
              ),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            padding: const EdgeInsets.all(14),
            child: child,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(displayName),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
            children: [
              if (_heroImageUrl != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 6,
                    child: CachedNetworkImage(
                      imageUrl: _heroImageUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => Container(
                        decoration: BoxDecoration(
                          gradient: surfaces.signatureGradient,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              glass(
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: surfaces.elevated,
                      backgroundImage: headerArt != null
                          ? CachedNetworkImageProvider(headerArt)
                          : null,
                      child: headerArt == null
                          ? const Icon(Icons.person_outline)
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: DimensionTypography.cardTitle(fontSize: 20),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [a?.headline, a?.locationRegion]
                                .where((v) => (v ?? '').trim().isNotEmpty)
                                .join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: surfaces.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: scheme.primary.withValues(alpha: 0.35),
                        ),
                        color: scheme.primary.withValues(alpha: 0.10),
                      ),
                      child: Text(
                        'Discography',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ),
                    if (_isLiveNow)
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: Colors.red.withValues(alpha: 0.15),
                            border: Border.all(
                              color: Colors.red.withValues(alpha: 0.35),
                            ),
                          ),
                          child: const Text(
                            'LIVE',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Colors.red,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (!_isOwnerProfile && isLoggedIn) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _followLoading || _favoriteLoading
                            ? null
                            : _toggleFollow,
                        child: Text(_following ? 'Following' : 'Follow'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.tonalIcon(
                        onPressed: _favoriteLoading || _followLoading
                            ? null
                            : _toggleFavorite,
                        icon: Icon(
                          _favorited ? Icons.star : Icons.star_border,
                          size: 18,
                        ),
                        label: Text(_favorited ? 'Favorited' : 'Favorite'),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  if (_isLiveNow)
                    FilledButton.icon(
                      onPressed: () {
                        Navigator.pushNamed(
                          context,
                          AppRoutes.watchLive,
                          arguments: widget.artistId,
                        );
                      },
                      icon: const Icon(Icons.live_tv),
                      label: const Text('Watch live'),
                    ),
                  if (_isLiveNow && isLoggedIn) const SizedBox(width: 10),
                  if (isLoggedIn)
                    OutlinedButton.icon(
                      onPressed: _liveActionLoading ? null : _startLive,
                      icon: const Icon(Icons.sensors),
                      label: Text(_liveActionLoading ? 'Opening…' : 'Go live'),
                    ),
                ],
              ),
              if ((a?.bio ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  a!.bio!.trim(),
                  style: TextStyle(color: surfaces.textSecondary),
                ),
              ],
              ...(() {
                final socialLinks = _buildSocialLinks(a);
                if (socialLinks.isEmpty) return <Widget>[];
                return <Widget>[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 2,
                    children: socialLinks,
                  ),
                ];
              })(),
              const SizedBox(height: 16),
              ..._buildDiscographySections(surfaces, scheme, glass),
            ],
          ),

          // Sticky “Now Playing” bar
          if (_activeSongId != null)
            Positioned(
              left: 16,
              right: 16,
              bottom: 12,
              child: glass(
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _activeIndex > 0 ? _playPrev : null,
                      icon: const Icon(Icons.skip_previous),
                    ),
                    IconButton(
                      onPressed: () async {
                        final idx = _activeIndex;
                        if (idx < 0) return;
                        await _playSong(_tracks[idx]);
                      },
                      icon: Icon(
                        _isPlaying ? Icons.pause_circle : Icons.play_circle,
                      ),
                      iconSize: 40,
                    ),
                    IconButton(
                      onPressed:
                          (_activeIndex >= 0 &&
                              _activeIndex < _tracks.length - 1)
                          ? _playNext
                          : null,
                      icon: const Icon(Icons.skip_next),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _tracks[_activeIndex].title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            _tracks[_activeIndex].artistName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: surfaces.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StreamBuilder<Duration>(
                      stream: _player.positionStream,
                      builder: (context, snap) {
                        final pos = snap.data ?? Duration.zero;
                        final dur = _player.duration ?? Duration.zero;
                        final value = dur.inMilliseconds <= 0
                            ? 0.0
                            : (pos.inMilliseconds / dur.inMilliseconds).clamp(
                                0.0,
                                1.0,
                              );
                        return SizedBox(
                          width: 96,
                          child: LinearProgressIndicator(
                            value: value,
                            backgroundColor: surfaces.border.withValues(
                              alpha: 0.6,
                            ),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              scheme.primary,
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildDiscographySections(
    NetworxSurfaces surfaces,
    ColorScheme scheme,
    Widget Function({required Widget child}) glass,
  ) {
    final beats = _tracks.where((t) => t.isBeat).toList();
    final songs = _tracks.where((t) => !t.isBeat).toList();
    final widgets = <Widget>[];

    if (beats.isNotEmpty) {
      widgets.add(
        Text(
          'Beats for sale',
          style: DimensionTypography.cardTitle(fontSize: 20),
        ),
      );
      widgets.add(const SizedBox(height: 4));
      widgets.add(
        Text(
          'Full listen before you buy — not a 30s sample.',
          style: TextStyle(color: surfaces.textSecondary, fontSize: 12),
        ),
      );
      widgets.add(const SizedBox(height: 8));
      widgets.addAll(
        beats.map((s) => _buildTrackCard(s, surfaces, scheme, glass)),
      );
      widgets.add(const SizedBox(height: 16));
    }

    widgets.add(
      Text(
        'Songs',
        style: DimensionTypography.cardTitle(fontSize: 20),
      ),
    );
    widgets.add(const SizedBox(height: 8));
    if (songs.isEmpty) {
      widgets.add(
        Text(
          _tracks.isEmpty
              ? (_isOwnerProfile ? 'No tracks yet.' : 'No approved tracks yet.')
              : (beats.isNotEmpty
                  ? 'No songs in this portfolio (beats listed above).'
                  : (_isOwnerProfile
                      ? 'No songs yet.'
                      : 'No approved songs yet.')),
          style: TextStyle(color: surfaces.textSecondary),
        ),
      );
    } else {
      widgets.addAll(
        songs.map((s) => _buildTrackCard(s, surfaces, scheme, glass)),
      );
    }
    return widgets;
  }

  Widget _buildTrackCard(
    Song s,
    NetworxSurfaces surfaces,
    ColorScheme scheme,
    Widget Function({required Widget child}) glass,
  ) {
                  final active = _activeSongId == s.id;
                  final liked = _likedBySongId[s.id] == true;
                  final favorited = _favoritedBySongId[s.id] == true;
                  final accessLabel = _canStreamFull(s)
                      ? (_isOwnerProfile
                            ? (s.isBeat
                                ? 'Your beat · full play'
                                : 'Your track · full play')
                            : (_ownsSong(s)
                                ? 'Purchased · full play'
                                : 'Pro-Radio · full play'))
                      : (s.isBeat
                          ? (s.forSale
                              ? 'BEAT FOR SALE · full preview'
                              : 'Beat · full preview')
                          : (s.proRadioEligible
                              ? 'Pro-Radio · subscribe for full play'
                              : 'Song · 30s sample only'));
                  final focused = _highlightedSongId == s.id;
                  return Padding(
                    key: _keyForSong(s.id),
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 280),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        border: focused
                            ? Border.all(color: scheme.primary, width: 2)
                            : Border.all(color: Colors.transparent, width: 2),
                      ),
                      child: glass(
                      // Two rows so play/buy never crush the title into
                      // mid-word wraps like "previe/w" or "View/likes".
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: SizedBox(
                                  width: 52,
                                  height: 52,
                                  child: (s.artworkUrl ?? '').isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: s.artworkUrl!,
                                          fit: BoxFit.cover,
                                          errorWidget: (context, url, error) =>
                                              Container(
                                                color: surfaces.elevated,
                                                child: const Icon(
                                                  Icons.music_note,
                                                ),
                                              ),
                                        )
                                      : Container(
                                          decoration: BoxDecoration(
                                            gradient:
                                                surfaces.signatureGradient,
                                          ),
                                          child: const Icon(Icons.music_note),
                                        ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (s.isBeat) ...[
                                      Container(
                                        margin: const EdgeInsets.only(bottom: 4),
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF4D03F)
                                              .withValues(alpha: 0.18),
                                          borderRadius: BorderRadius.circular(999),
                                          border: Border.all(
                                            color: const Color(0xFFF4D03F)
                                                .withValues(alpha: 0.5),
                                          ),
                                        ),
                                        child: Text(
                                          s.forSale
                                              ? 'BEAT FOR SALE'
                                              : 'BEAT',
                                          style: TextStyle(
                                            color: scheme.brightness ==
                                                    Brightness.dark
                                                ? const Color(0xFFF4D03F)
                                                : const Color(0xFFB45309),
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                      ),
                                    ] else ...[
                                      Container(
                                        margin: const EdgeInsets.only(bottom: 4),
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: surfaces.border
                                              .withValues(alpha: 0.35),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          'SONG · SAMPLE ONLY',
                                          style: TextStyle(
                                            color: surfaces.textMuted,
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                            letterSpacing: 1.0,
                                          ),
                                        ),
                                      ),
                                    ],
                                    Text(
                                      s.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      softWrap: true,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        height: 1.25,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${s.likeCount} likes · ${s.listenCount ?? s.playCount} listens',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        color: surfaces.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                    Text(
                                      accessLabel,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      softWrap: false,
                                      style: TextStyle(
                                        color: _ownsSong(s) || s.isBeat
                                            ? scheme.primary
                                            : surfaces.textMuted,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: () => _showLikesSheet(s),
                                      style: TextButton.styleFrom(
                                        minimumSize: Size.zero,
                                        padding: const EdgeInsets.only(top: 2),
                                        tapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                        alignment: Alignment.centerLeft,
                                      ),
                                      child: const Text('View likes'),
                                    ),
                                  ],
                                ),
                              ),
                              if (!s.isBeat)
                                AddToPlaylistButton(
                                  songId: s.id,
                                  songTitle: s.title,
                                  color: surfaces.textSecondary,
                                ),
                              IconButton(
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(
                                  minWidth: 36,
                                  minHeight: 40,
                                ),
                                tooltip: favorited
                                    ? 'Remove favorite'
                                    : 'Favorite for alerts',
                                onPressed: () => _toggleSongFavorite(s),
                                icon: Icon(
                                  favorited ? Icons.star : Icons.star_border,
                                  color: favorited
                                      ? scheme.primary
                                      : surfaces.textSecondary,
                                ),
                              ),
                              IconButton(
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(
                                  minWidth: 36,
                                  minHeight: 40,
                                ),
                                tooltip: liked ? 'Unlike' : 'Like',
                                onPressed: () => _toggleLike(s),
                                icon: Icon(
                                  liked
                                      ? Icons.favorite
                                      : Icons.favorite_border,
                                  color: liked
                                      ? scheme.primary
                                      : surfaces.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              FilledButton.icon(
                                onPressed: () => _playSong(s),
                                icon: Icon(
                                  active && _isPlaying
                                      ? Icons.pause
                                      : Icons.play_arrow,
                                  size: 20,
                                ),
                                label: Text(
                                  active && _isPlaying
                                      ? 'Pause'
                                      : (s.isBeat
                                          ? 'Play full beat'
                                          : (_canStreamFull(s)
                                              ? 'Play full song'
                                              : (s.proRadioEligible
                                                  ? 'Play with Pro-Radio'
                                                  : 'Play sample'))),
                                ),
                              ),
                              const SizedBox(width: 8),
                              if (_ownsSong(s))
                                OutlinedButton.icon(
                                  onPressed: _downloadingId == s.id
                                      ? null
                                      : () => _downloadSong(s),
                                  icon: _downloadingId == s.id
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.download_outlined,
                                          size: 18,
                                        ),
                                  label: const Text('Download'),
                                )
                              else if (s.forSale)
                                OutlinedButton(
                                  onPressed: _buyingId == s.id
                                      ? null
                                      : () => _buySong(s),
                                  child: _buyingId == s.id
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Text(
                                          s.isBeat
                                              ? 'Buy beat ${_formatPrice(s.priceCents)}'
                                              : 'Buy ${_formatPrice(s.priceCents)}',
                                        ),
                                ),
                            ],
                          ),
                        ],
                      ),
                      ),
                    ),
                  );
  }
}
