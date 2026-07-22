import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Inline looping muted-by-default video for Social / Pro feed cards.
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
    super.dispose();
  }

  Future<void> _toggleMute() async {
    final c = _controller;
    if (c == null || !_ready) return;
    final nextMuted = !_muted;
    await c.setVolume(nextMuted ? 0 : 1);
    if (!mounted) return;
    setState(() => _muted = nextMuted);
  }

  Future<void> _togglePlay() async {
    final c = _controller;
    if (c == null || !_ready) return;
    if (c.value.isPlaying) {
      await c.pause();
    } else {
      await c.play();
    }
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
