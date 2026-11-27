import 'dart:async';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:video_player/video_player.dart';

import '../../../core/brand/brand_assets.dart';
import '../../../core/services/audio_player_service.dart';
import 'feed_post_video.dart';

/// Sound choice shared by every reel while the app is open.
///
/// Reels start silent so live radio keeps playing. Once the viewer turns
/// sound on, every reel they swipe to plays with sound until they turn it off.
class ReelSound {
  ReelSound._();

  static final ValueNotifier<bool> muted = ValueNotifier<bool>(true);
}

/// Picture that fills the screen without cropping: the whole image sits on top
/// of a blurred, dimmed copy of itself.
class ReelImage extends StatelessWidget {
  const ReelImage({super.key, required this.url, this.logoFallback = false});

  final String url;
  final bool logoFallback;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Widget fallback() => Container(
      color: cs.surfaceContainerHighest,
      padding: const EdgeInsets.all(48),
      alignment: Alignment.center,
      child: logoFallback
          ? Image.asset(BrandAssets.logoCyanAsset, fit: BoxFit.contain)
          : const Icon(Icons.broken_image_outlined, color: Colors.white54),
    );
    return Stack(
      fit: StackFit.expand,
      children: [
        CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.cover,
          memCacheWidth: 200,
          placeholder: (_, _) => const ColoredBox(color: Colors.black),
          errorWidget: (_, _, _) => const ColoredBox(color: Colors.black),
        ),
        BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 28, sigmaY: 28),
          child: const ColoredBox(color: Color(0x99000000)),
        ),
        CachedNetworkImage(
          imageUrl: url,
          fit: BoxFit.contain,
          placeholder: (_, _) => const SizedBox.shrink(),
          errorWidget: (_, _, _) => fallback(),
        ),
      ],
    );
  }
}

/// Looping reel video. It plays only while [active] is true (the reel on
/// screen) and its feed tab is showing. Neighbouring reels load but stay
/// paused so the next swipe starts right away.
class ReelVideo extends StatefulWidget {
  const ReelVideo({
    super.key,
    required this.url,
    required this.active,
    required this.paused,
  });

  final String url;
  final bool active;

  /// The viewer tapped to pause this clip.
  final bool paused;

  @override
  State<ReelVideo> createState() => _ReelVideoState();
}

class _ReelVideoState extends State<ReelVideo> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _tabVisible = true;
  bool _holdingRadio = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    ReelSound.muted.addListener(_onSoundChanged);
    unawaited(_init());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = FeedMediaPlayback.isActive(context);
    if (visible == _tabVisible) return;
    _tabVisible = visible;
    unawaited(_sync());
  }

  @override
  void didUpdateWidget(covariant ReelVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _disposeController();
      unawaited(_init());
      return;
    }
    if (oldWidget.active != widget.active ||
        oldWidget.paused != widget.paused) {
      unawaited(_sync());
    }
  }

  @override
  void dispose() {
    ReelSound.muted.removeListener(_onSoundChanged);
    _generation++;
    _syncRadio(audible: false);
    _disposeController();
    super.dispose();
  }

  void _onSoundChanged() => unawaited(_sync());

  void _disposeController() {
    final c = _controller;
    _controller = null;
    _ready = false;
    c?.dispose();
  }

  Future<void> _init() async {
    final generation = ++_generation;
    if (mounted) {
      setState(() {
        _ready = false;
        _failed = false;
      });
    }
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _controller = c;
    try {
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(ReelSound.muted.value ? 0 : 1);
      if (!mounted || generation != _generation) return;
      setState(() => _ready = true);
      await _sync();
    } catch (_) {
      if (!mounted || generation != _generation) return;
      setState(() => _failed = true);
    }
  }

  Future<void> _sync() async {
    final c = _controller;
    if (c == null || !_ready || !mounted) return;
    final muted = ReelSound.muted.value;
    final wantPlay = widget.active && !widget.paused && _tabVisible;
    try {
      await c.setVolume(muted ? 0 : 1);
      if (wantPlay) {
        if (!c.value.isPlaying) await c.play();
      } else {
        if (c.value.isPlaying) await c.pause();
        if (!widget.active) await c.seekTo(Duration.zero);
      }
    } catch (_) {
      // The controller can be disposed mid-swipe. The next sync recovers.
    }
    _syncRadio(audible: wantPlay && !muted);
  }

  /// Live radio steps aside only while this clip is audible.
  void _syncRadio({required bool audible}) {
    if (audible && !_holdingRadio) {
      _holdingRadio = true;
      AudioPlayerService.handler.holdForExternalAudio();
    } else if (!audible && _holdingRadio) {
      _holdingRadio = false;
      AudioPlayerService.handler.releaseExternalAudio();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: Icon(Icons.broken_image_outlined, color: Colors.white54),
        ),
      );
    }
    final c = _controller;
    if (!_ready || c == null) {
      return ColoredBox(
        color: Colors.black,
        child: Center(
          child: widget.active
              ? const CircularProgressIndicator(color: Colors.white54)
              : null,
        ),
      );
    }
    final size = c.value.size;
    final portrait = size.height >= size.width * 0.9;
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Colors.black),
        ClipRect(
          child: FittedBox(
            fit: portrait ? BoxFit.cover : BoxFit.contain,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: size.width,
              height: size.height,
              child: VideoPlayer(c),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: ValueListenableBuilder<VideoPlayerValue>(
            valueListenable: c,
            builder: (_, value, _) {
              final total = value.duration.inMilliseconds;
              final progress = total > 0
                  ? (value.position.inMilliseconds / total).clamp(0.0, 1.0)
                  : 0.0;
              return LinearProgressIndicator(
                value: progress,
                minHeight: 2,
                backgroundColor: Colors.white24,
                valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Audio post shown as cover art. Plays automatically once the viewer has
/// turned sound on, and only while its reel is on screen.
class ReelAudio extends StatefulWidget {
  const ReelAudio({
    super.key,
    required this.audioUrl,
    required this.coverUrl,
    required this.active,
    required this.paused,
  });

  final String audioUrl;
  final String coverUrl;
  final bool active;
  final bool paused;

  @override
  State<ReelAudio> createState() => _ReelAudioState();
}

class _ReelAudioState extends State<ReelAudio> {
  AudioPlayer? _player;
  StreamSubscription<Duration>? _positionSub;
  final ValueNotifier<double> _progress = ValueNotifier<double>(0);
  Duration _duration = Duration.zero;
  bool _failed = false;
  bool _tabVisible = true;
  bool _holdingRadio = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    ReelSound.muted.addListener(_onSoundChanged);
    unawaited(_sync());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = FeedMediaPlayback.isActive(context);
    if (visible == _tabVisible) return;
    _tabVisible = visible;
    unawaited(_sync());
  }

  @override
  void didUpdateWidget(covariant ReelAudio oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.audioUrl != widget.audioUrl) {
      unawaited(_releasePlayer());
    }
    if (oldWidget.active != widget.active ||
        oldWidget.paused != widget.paused ||
        oldWidget.audioUrl != widget.audioUrl) {
      unawaited(_sync());
    }
  }

  @override
  void dispose() {
    ReelSound.muted.removeListener(_onSoundChanged);
    _generation++;
    _syncRadio(audible: false);
    unawaited(_positionSub?.cancel());
    _player?.dispose();
    _player = null;
    _progress.dispose();
    super.dispose();
  }

  void _onSoundChanged() => unawaited(_sync());

  Future<void> _releasePlayer() async {
    _generation++;
    await _positionSub?.cancel();
    _positionSub = null;
    final player = _player;
    _player = null;
    _progress.value = 0;
    await player?.dispose();
  }

  Future<AudioPlayer?> _ensurePlayer() async {
    final existing = _player;
    if (existing != null) return existing;
    final generation = ++_generation;
    final player = AudioPlayer();
    try {
      final duration = await player.setUrl(widget.audioUrl);
      await player.setLoopMode(LoopMode.one);
      if (!mounted || generation != _generation) {
        await player.dispose();
        return null;
      }
      _player = player;
      _duration = duration ?? Duration.zero;
      _positionSub = player.positionStream.listen((position) {
        final total = _duration.inMilliseconds;
        _progress.value = total > 0
            ? (position.inMilliseconds / total).clamp(0.0, 1.0)
            : 0.0;
      });
      if (_failed && mounted) setState(() => _failed = false);
      return player;
    } catch (_) {
      await player.dispose();
      if (mounted && generation == _generation) {
        setState(() => _failed = true);
      }
      return null;
    }
  }

  Future<void> _sync() async {
    if (!mounted) return;
    final wantPlay =
        widget.active &&
        !widget.paused &&
        _tabVisible &&
        !ReelSound.muted.value;
    if (wantPlay) {
      final player = await _ensurePlayer();
      if (player == null || !mounted) return;
      // The viewer may have swiped away while the track was loading.
      final stillWanted =
          widget.active &&
          !widget.paused &&
          _tabVisible &&
          !ReelSound.muted.value;
      if (!stillWanted) return;
      _syncRadio(audible: true);
      unawaited(player.play());
      return;
    }
    _syncRadio(audible: false);
    final player = _player;
    if (player == null) return;
    if (!widget.active) {
      await _releasePlayer();
    } else {
      await player.pause();
    }
  }

  void _syncRadio({required bool audible}) {
    if (audible && !_holdingRadio) {
      _holdingRadio = true;
      AudioPlayerService.handler.holdForExternalAudio();
    } else if (!audible && _holdingRadio) {
      _holdingRadio = false;
      AudioPlayerService.handler.releaseExternalAudio();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ReelImage(url: widget.coverUrl, logoFallback: true),
        if (_failed)
          const Align(
            alignment: Alignment(0, 0.35),
            child: Text(
              'Audio unavailable',
              style: TextStyle(color: Colors.white70),
            ),
          ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: ValueListenableBuilder<double>(
            valueListenable: _progress,
            builder: (_, value, _) => LinearProgressIndicator(
              value: value,
              minHeight: 2,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
