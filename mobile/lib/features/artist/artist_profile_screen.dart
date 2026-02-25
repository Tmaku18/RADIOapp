import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:audio_service/audio_service.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/song.dart';
import '../../core/services/api_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/livestream_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../livestream/go_live_screen.dart';
import '../livestream/watch_live_screen.dart';

class ArtistProfileScreen extends StatefulWidget {
  final String artistId;
  const ArtistProfileScreen({super.key, required this.artistId});

  @override
  State<ArtistProfileScreen> createState() => _ArtistProfileScreenState();
}

class _ArtistProfileScreenState extends State<ArtistProfileScreen> {
  final SongsService _songs = SongsService();
  final AudioPlayer _player = AudioPlayerService().player;
  final LivestreamService _live = LivestreamService();

  bool _loading = true;
  String? _error;
  app_user.User? _artist;
  List<Song> _tracks = const [];
  String? _activeSongId;
  bool _isPlaying = false;
  final Map<String, bool> _likedBySongId = <String, bool>{};
  final Set<String> _recordedListenForSongIds = <String>{};
  Timer? _listenTimer;
  Map<String, dynamic>? _liveSession;
  bool _liveActionLoading = false;

  @override
  void initState() {
    super.initState();
    _load();
    _player.playerStateStream.listen((s) {
      if (!mounted) return;
      setState(() => _isPlaying = s.playing);
    });
    _player.processingStateStream.listen((st) {
      if (!mounted) return;
      if (st == ProcessingState.completed) {
        _playNext();
      }
    });
  }

  @override
  void dispose() {
    _listenTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ApiService();
      final artistRaw = await api.get('users/${widget.artistId}');
      final artist = (artistRaw is Map<String, dynamic>)
          ? app_user.User.fromJson(artistRaw)
          : null;
      final tracks = await _songs.listApprovedByArtist(widget.artistId, limit: 100);
      if (!mounted) return;
      setState(() {
        _artist = artist;
        _tracks = tracks;
      });
      await _loadLikes();
      await _loadLiveStatus();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
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
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const GoLiveScreen()),
      );
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
    final same = _activeSongId == s.id;
    if (same && toggle) {
      if (_isPlaying) {
        await _player.pause();
      } else {
        await _player.play();
      }
      return;
    }

    _listenTimer?.cancel();
    await _player.setAudioSource(
      AudioSource.uri(
        Uri.parse(s.audioUrl),
        tag: MediaItem(
          id: s.id,
          title: s.title,
          artist: s.artistName,
          artUri: (s.artworkUrl ?? '').isNotEmpty ? Uri.tryParse(s.artworkUrl!) : null,
        ),
      ),
    );
    await _player.play();
    if (!mounted) return;
    setState(() => _activeSongId = s.id);
    _scheduleListenRecord(s.id);
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
    final idx = _activeIndex;
    if (idx < 0) return;
    final next = idx + 1;
    if (next >= _tracks.length) return;
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Log in to like songs.')),
      );
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Like failed: $e')),
      );
    }
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
            child: Text(_error!, style: TextStyle(color: surfaces.textSecondary)),
          ),
        ),
      );
    }

    final a = _artist;
    final displayName = a?.displayName?.trim().isNotEmpty == true ? a!.displayName! : 'Artist';
    final headerArt = (a?.avatarUrl?.isNotEmpty == true) ? a!.avatarUrl! : null;
    final auth = Provider.of<AuthService>(context, listen: false);
    final isLoggedIn = auth.currentUser != null;

    Widget glass({required Widget child}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: surfaces.glassBlur, sigmaY: surfaces.glassBlur),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(color: Colors.white.withValues(alpha: surfaces.glassBorderOpacity)),
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
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
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
                      backgroundImage: headerArt != null ? CachedNetworkImageProvider(headerArt) : null,
                      child: headerArt == null ? const Icon(Icons.person_outline) : null,
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
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: 'SpaceGrotesk'),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [a?.headline, a?.locationRegion].where((v) => (v ?? '').trim().isNotEmpty).join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: surfaces.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: scheme.primary.withValues(alpha: 0.35)),
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: Colors.red.withValues(alpha: 0.15),
                            border: Border.all(color: Colors.red.withValues(alpha: 0.35)),
                          ),
                          child: const Text('LIVE', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.red)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (_isLiveNow)
                    FilledButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => WatchLiveScreen(artistId: widget.artistId)),
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
              const SizedBox(height: 16),
              Text(
                'Songs',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: 'Lora'),
              ),
              const SizedBox(height: 8),
              if (_tracks.isEmpty)
                Text('No approved songs yet.', style: TextStyle(color: surfaces.textSecondary))
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
                                          Container(color: surfaces.elevated, child: const Icon(Icons.music_note)),
                                    )
                                  : Container(
                                      decoration: BoxDecoration(gradient: surfaces.signatureGradient),
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
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${s.likeCount} likes · ${s.playCount} plays',
                                  style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => _toggleLike(s),
                            icon: Icon(
                              liked ? Icons.favorite : Icons.favorite_border,
                              color: liked ? scheme.primary : surfaces.textSecondary,
                            ),
                          ),
                          FilledButton(
                            onPressed: () => _playSong(s),
                            child: Icon(active && _isPlaying ? Icons.pause : Icons.play_arrow),
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
                      icon: Icon(_isPlaying ? Icons.pause_circle : Icons.play_circle),
                      iconSize: 40,
                    ),
                    IconButton(
                      onPressed: (_activeIndex >= 0 && _activeIndex < _tracks.length - 1) ? _playNext : null,
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
                            style: TextStyle(color: surfaces.textSecondary, fontSize: 12),
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
                            : (pos.inMilliseconds / dur.inMilliseconds).clamp(0.0, 1.0);
                        return SizedBox(
                          width: 96,
                          child: LinearProgressIndicator(
                            value: value,
                            backgroundColor: surfaces.border.withValues(alpha: 0.6),
                            valueColor: AlwaysStoppedAnimation<Color>(scheme.primary),
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

