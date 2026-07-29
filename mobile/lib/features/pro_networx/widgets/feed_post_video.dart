import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/services/audio_player_service.dart';

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

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void didUpdateWidget(covariant FeedPostVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _disposeController();
      unawaited(_softResumeRadioIfNeeded());
      _muted = true;
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
      await c.setVolume(0);
      await c.play();
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

  Future<void> _togglePlay() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final willPlay = !c.value.isPlaying;
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
    return Stack(
      fit: StackFit.expand,
      children: [
        FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: c.value.size.width,
            height: c.value.size.height,
            child: VideoPlayer(c),
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
    );
  }
}
