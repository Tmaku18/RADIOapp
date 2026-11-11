import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// A song clip in a direct message. Tap it to watch, with the audio.
class DmVideoBubble extends StatelessWidget {
  const DmVideoBubble({super.key, required this.url, required this.color});

  final String url;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => _DmVideoPage(url: url),
          ),
        );
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.play_circle_fill, color: color),
          const SizedBox(width: 8),
          Text('Watch clip', style: TextStyle(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _DmVideoPage extends StatefulWidget {
  const _DmVideoPage({required this.url});

  final String url;

  @override
  State<_DmVideoPage> createState() => _DmVideoPageState();
}

class _DmVideoPageState extends State<_DmVideoPage> {
  late final VideoPlayerController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _open();
  }

  Future<void> _open() async {
    try {
      await _controller.initialize();
      if (!mounted) return;
      setState(() {});
      await _controller.play();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not play this clip.');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Clip'),
      ),
      body: Center(
        child: _error != null
            ? Text(_error!, style: const TextStyle(color: Colors.white))
            : _controller.value.isInitialized
                ? AspectRatio(
                    aspectRatio: _controller.value.aspectRatio == 0
                        ? 9 / 16
                        : _controller.value.aspectRatio,
                    child: VideoPlayer(_controller),
                  )
                : const CircularProgressIndicator(),
      ),
    );
  }
}
