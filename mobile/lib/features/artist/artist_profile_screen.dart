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
import '../../core/services/payments_service.dart';
import '../../core/services/livestream_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/users_service.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';

class ArtistProfileScreen extends StatefulWidget {
  final String artistId;
  const ArtistProfileScreen({super.key, required this.artistId});

  @override
  State<ArtistProfileScreen> createState() => _ArtistProfileScreenState();
}

class _ArtistProfileScreenState extends State<ArtistProfileScreen> {
  final SongsService _songs = SongsService();
  final PaymentsService _payments = PaymentsService();
  final AudioPlayer _player = AudioPlayerService().player;
  final LivestreamService _live = LivestreamService();
  final UsersService _users = UsersService();

  bool _loading = true;
  String? _error;
  app_user.User? _artist;
  List<Song> _tracks = const [];
  String? _activeSongId;
  bool _isPlaying = false;
  final Map<String, bool> _likedBySongId = <String, bool>{};
  final Set<String> _recordedListenForSongIds = <String>{};
  final Set<String> _ownedSongIds = <String>{};
  String? _buyingId;
  String? _downloadingId;
  Timer? _listenTimer;
  Timer? _sampleStopTimer;
  Map<String, dynamic>? _liveSession;
  bool _liveActionLoading = false;
  bool _isOwnerProfile = false;
  bool _following = false;
  bool _favorited = false;
  bool _followLoading = false;
  bool _favoriteLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
    _player.playerStateStream.listen((s) {
      if (!mounted) return;
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
      if (st == ProcessingState.completed && _isOurSourceActive) {
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

  @override
  void dispose() {
    _listenTimer?.cancel();
    _sampleStopTimer?.cancel();
    super.dispose();
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
          : await _songs.listApprovedByArtist(widget.artistId, limit: 100);
      if (!mounted) return;
      setState(() {
        _isOwnerProfile = isOwner;
        _artist = artist;
        _tracks = tracks;
      });
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
      if (mounted) setState(() => _loading = false);
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
    // Fetch like status best-effort (one-by-one, can be optimized later).
    for (final s in _tracks) {
      try {
        final liked = await _songs.getLikeStatus(s.id);
        if (!mounted) return;
        setState(() => _likedBySongId[s.id] = liked);
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

  Future<void> _playSong(Song s, {bool toggle = true}) async {
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

    final owns = _ownsSong(s);
    // Owners/buyers stream the full track; everyone else gets the 30s sample.
    String? playUrl;
    if (owns) {
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
        const SnackBar(content: Text('Preview not available yet.')),
      );
      return;
    }

    final usingFallbackSample =
        !owns && ((s.sampleUrl ?? '').isEmpty) && s.audioUrl.isNotEmpty;

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
              'source': owns ? 'discography' : 'sample',
              // Non-owners must not scrub: the emulated sample plays the full
              // file with a 30s stop timer, so seeking would expose the track.
              'noSeek': !owns,
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
    // the full track.
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
      final res = await _payments.buySong(songId: s.id);
      final url = (res['url'] ?? res['checkoutUrl'])?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Could not start checkout.');
      }
      await _openExternalUrl(url);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Complete your purchase in the browser, then tap refresh.',
          ),
        ),
      );
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
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
            children: [
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
              Text(
                'Songs',
                style: DimensionTypography.cardTitle(fontSize: 20),
              ),
              const SizedBox(height: 8),
              if (_tracks.isEmpty)
                Text(
                  _isOwnerProfile ? 'No songs yet.' : 'No approved songs yet.',
                  style: TextStyle(color: surfaces.textSecondary),
                )
              else
                ..._tracks.map((s) {
                  final active = _activeSongId == s.id;
                  final liked = _likedBySongId[s.id] == true;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: glass(
                      child: Row(
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
                                            child: const Icon(Icons.music_note),
                                          ),
                                    )
                                  : Container(
                                      decoration: BoxDecoration(
                                        gradient: surfaces.signatureGradient,
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
                                Text(
                                  s.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${s.likeCount} likes · ${s.listenCount ?? s.playCount} listens',
                                  style: TextStyle(
                                    color: surfaces.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                                Text(
                                  _ownsSong(s)
                                      ? (_isOwnerProfile
                                            ? 'Your track · full play'
                                            : 'Purchased · full play')
                                      : 'Sample · 30s preview',
                                  style: TextStyle(
                                    color: _ownsSong(s)
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
                                    padding: EdgeInsets.zero,
                                    tapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  child: const Text('View likes'),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => _toggleLike(s),
                            icon: Icon(
                              liked ? Icons.favorite : Icons.favorite_border,
                              color: liked
                                  ? scheme.primary
                                  : surfaces.textSecondary,
                            ),
                          ),
                          FilledButton(
                            onPressed: () => _playSong(s),
                            child: Icon(
                              active && _isPlaying
                                  ? Icons.pause
                                  : Icons.play_arrow,
                            ),
                          ),
                          const SizedBox(width: 6),
                          if (_ownsSong(s))
                            IconButton(
                              tooltip: 'Download',
                              onPressed: _downloadingId == s.id
                                  ? null
                                  : () => _downloadSong(s),
                              icon: _downloadingId == s.id
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.download_outlined),
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
                                  : Text('Buy ${_formatPrice(s.priceCents)}'),
                            ),
                        ],
                      ),
                    ),
                  );
                }),
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
}
