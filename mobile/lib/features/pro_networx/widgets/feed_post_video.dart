import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/services/audio_player_service.dart';

/// Whether the feed surface that owns these clips is the one on screen.
///
/// The home tabs keep the feed mounted after you leave it, so clips have to
/// be told to stop instead of relying on dispose.
class FeedMediaPlayback extends InheritedWidget {
  const FeedMediaPlayback({
    super.key,
    required this.active,
    required super.child,
  });

  final bool active;

  static bool isActive(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<FeedMediaPlayback>();
    return scope?.active ?? true;
  }

  @override
  bool updateShouldNotify(FeedMediaPlayback oldWidget) =>
      active != oldWidget.active;
}

/// Inline looping muted-by-default video for Social / Pro feed cards.
///
/// Radio keeps playing while the clip is muted (autoplay preview). As soon as
/// the user turns sound on, live radio is soft-paused so the two never mix.
class FeedPostVideo extends StatefulWidget {
  const FeedPostVideo({super.key, required this.url});

  final String url;

  @override
  State<FeedPostVideo> createState() => _FeedPostVideoState();
}

class _FeedPostVideoState extends State<FeedPostVideo> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _muted = true;
  bool _didSoftPauseRadio = false;
  bool _tabVisible = true;
  /// Whether the clip should be running while this tab is on screen.
  bool _shouldPlay = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = FeedMediaPlayback.isActive(context);
    if (visible == _tabVisible) return;
    _tabVisible = visible;
    if (visible) {
      unawaited(_resumeIfWanted());
    } else {
      unawaited(_pauseBecauseHidden());
    }
  }

  @override
  void didUpdateWidget(covariant FeedPostVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _disposeController();
      unawaited(_softResumeRadioIfNeeded());
      _muted = true;
      _shouldPlay = true;
      _init();
    }
  }

  Future<void> _init() async {
    setState(() {
      _ready = false;
      _failed = false;
    });
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      _controller = c;
      await c.initialize();
      await c.setLooping(true);
      await c.setVolume(_muted ? 0 : 1);
      if (!mounted) return;
      // The feed tab stays alive under the radio tab. Don't start (or keep)
      // the clip once that tab is off screen, or the two play at once.
      final visible = FeedMediaPlayback.isActive(context);
      _tabVisible = visible;
      if (visible && _shouldPlay) {
        await c.play();
      }
      if (!mounted) return;
      if (!FeedMediaPlayback.isActive(context) && c.value.isPlaying) {
        await c.pause();
      }
      if (!mounted) return;
      setState(() => _ready = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = true);
    }
  }

  void _disposeController() {
    final c = _controller;
    _controller = null;
    c?.dispose();
  }

  @override
  void dispose() {
    _disposeController();
    unawaited(_softResumeRadioIfNeeded());
    super.dispose();
  }

  Future<void> _softPauseRadio() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
        _didSoftPauseRadio = true;
      }
    } catch (_) {}
  }

  Future<void> _softResumeRadioIfNeeded() async {
    if (!_didSoftPauseRadio) return;
    _didSoftPauseRadio = false;
    try {
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  /// Radio only yields when this clip is actually audible.
  Future<void> _syncRadioWithAudiblePlayback({
    required bool muted,
    required bool playing,
  }) async {
    final audible = playing && !muted;
    if (audible) {
      await _softPauseRadio();
    } else {
      await _softResumeRadioIfNeeded();
    }
  }

  Future<void> _pauseBecauseHidden() async {
    final c = _controller;
    if (c != null && c.value.isInitialized && c.value.isPlaying) {
      await c.pause();
    }
    await _softResumeRadioIfNeeded();
    if (mounted) setState(() {});
  }

  Future<void> _resumeIfWanted() async {
    final c = _controller;
    if (!_tabVisible || !_shouldPlay || c == null || !_ready) return;
    if (!c.value.isPlaying) {
      await c.play();
    }
    await _syncRadioWithAudiblePlayback(muted: _muted, playing: true);
    if (mounted) setState(() {});
  }

  Future<void> _toggleMute() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final nextMuted = !_muted;
    await c.setVolume(nextMuted ? 0 : 1);
    await _syncRadioWithAudiblePlayback(
      muted: nextMuted,
      playing: c.value.isPlaying,
    );
    if (!mounted) return;
    setState(() => _muted = nextMuted);
  }

  Future<void> _openFullscreen() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final position = c.value.position;
    final wasPlaying = _shouldPlay;
    _shouldPlay = false;
    if (c.value.isPlaying) await c.pause();
    if (!mounted) return;
    await Navigator.of(context, rootNavigator: true).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => _FeedVideoFullscreenPage(
          url: widget.url,
          startAt: position,
        ),
      ),
    );
    if (!mounted) return;
    _shouldPlay = wasPlaying && _tabVisible;
    await _resumeIfWanted();
    if (mounted) setState(() {});
  }

  Future<void> _togglePlay() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final willPlay = !c.value.isPlaying;
    _shouldPlay = willPlay;
    if (willPlay) {
      await c.play();
    } else {
      await c.pause();
    }
    await _syncRadioWithAudiblePlayback(
      muted: _muted,
      playing: willPlay,
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: const Icon(Icons.broken_image_outlined, color: Colors.white54),
      );
    }
    final c = _controller;
    if (!_ready || c == null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: const CircularProgressIndicator(color: Colors.white54),
      );
    }
    // ClipRect keeps the platform video texture inside the same square frame
    // picture posts use — without it, tall clips can paint over the card header.
    return GestureDetector(
      onTap: _openFullscreen,
      child: ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: c.value.size.width,
              height: c.value.size.height,
              child: VideoPlayer(c),
            ),
          ),
          const Positioned(
            top: 8,
            right: 8,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: Padding(
                  padding: EdgeInsets.all(6),
                  child: Icon(Icons.fullscreen, color: Colors.white, size: 20),
                ),
              ),
            ),
          ),
          Positioned(
            right: 8,
            bottom: 8,
            child: Row(
              children: [
                Material(
                  color: Colors.black54,
                  shape: const CircleBorder(),
                  child: IconButton(
                    icon: Icon(
                      c.value.isPlaying ? Icons.pause : Icons.play_arrow,
                      color: Colors.white,
                    ),
                    onPressed: _togglePlay,
                  ),
                ),
                const SizedBox(width: 4),
                Material(
                  color: Colors.black54,
                  shape: const CircleBorder(),
                  child: IconButton(
                    icon: Icon(
                      _muted ? Icons.volume_off : Icons.volume_up,
                      color: Colors.white,
                    ),
                    onPressed: _toggleMute,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}

/// Full-frame viewer opened from a feed card. Owns its own player so the
/// inline preview can stay paused underneath.
class _FeedVideoFullscreenPage extends StatefulWidget {
  const _FeedVideoFullscreenPage({
    required this.url,
    required this.startAt,
  });

  final String url;
  final Duration startAt;

  @override
  State<_FeedVideoFullscreenPage> createState() =>
      _FeedVideoFullscreenPageState();
}

class _FeedVideoFullscreenPageState extends State<_FeedVideoFullscreenPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _muted = false;
  bool _didSoftPauseRadio = false;

  @override
  void initState() {
    super.initState();
    unawaited(_init());
  }

  Future<void> _init() async {
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      _controller = c;
      await c.initialize();
      if (widget.startAt > Duration.zero) {
        await c.seekTo(widget.startAt);
      }
      await c.setLooping(true);
      await c.setVolume(1);
      await _softPauseRadio();
      await c.play();
      if (!mounted) return;
      setState(() => _ready = true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    unawaited(_softResumeRadioIfNeeded());
    super.dispose();
  }

  Future<void> _softPauseRadio() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
        _didSoftPauseRadio = true;
      }
    } catch (_) {}
  }

  Future<void> _softResumeRadioIfNeeded() async {
    if (!_didSoftPauseRadio) return;
    _didSoftPauseRadio = false;
    try {
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  Future<void> _toggleMute() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final nextMuted = !_muted;
    await c.setVolume(nextMuted ? 0 : 1);
    if (nextMuted) {
      await _softResumeRadioIfNeeded();
    } else if (c.value.isPlaying) {
      await _softPauseRadio();
    }
    if (mounted) setState(() => _muted = nextMuted);
  }

  Future<void> _togglePlay() async {
    final c = _controller;
    if (c == null || !_ready) return;
    if (c.value.isPlaying) {
      await c.pause();
      await _softResumeRadioIfNeeded();
    } else {
      if (!_muted) await _softPauseRadio();
      await c.play();
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (_failed)
            const Center(
              child: Icon(Icons.broken_image_outlined, color: Colors.white54),
            )
          else if (!_ready || c == null)
            const Center(
              child: CircularProgressIndicator(color: Colors.white54),
            )
          else
            GestureDetector(
              onTap: _togglePlay,
              child: Center(
                child: AspectRatio(
                  aspectRatio: c.value.aspectRatio == 0
                      ? 1
                      : c.value.aspectRatio,
                  child: VideoPlayer(c),
                ),
              ),
            ),
          SafeArea(
            child: Align(
              alignment: Alignment.topLeft,
              child: IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ),
          ),
          if (_ready && c != null)
            SafeArea(
              child: Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        tooltip: c.value.isPlaying ? 'Pause' : 'Play',
                        onPressed: _togglePlay,
                        icon: Icon(
                          c.value.isPlaying ? Icons.pause : Icons.play_arrow,
                          color: Colors.white,
                          size: 36,
                        ),
                      ),
                      IconButton(
                        tooltip: _muted ? 'Unmute' : 'Mute',
                        onPressed: _toggleMute,
                        icon: Icon(
                          _muted ? Icons.volume_off : Icons.volume_up,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
