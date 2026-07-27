import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:video_player/video_player.dart';

import '../../../core/services/whep_player.dart';

/// In-app livestream viewer.
///
/// Cloudflare Stream produces no HLS/DASH for WHIP-published (in-app camera)
/// broadcasts, so those must be watched over WHEP (WebRTC). OBS/RTMP
/// broadcasts are watched via their HLS manifest. When the ingest mode is
/// unknown we try WHEP first and fall back to HLS.
class LiveStreamViewer extends StatefulWidget {
  final String? whepUrl;
  final String? hlsUrl;

  /// 'whip' | 'rtmp' | null (unknown).
  final String? ingestMode;

  const LiveStreamViewer({
    super.key,
    this.whepUrl,
    this.hlsUrl,
    this.ingestMode,
  });

  @override
  State<LiveStreamViewer> createState() => _LiveStreamViewerState();
}

class _LiveStreamViewerState extends State<LiveStreamViewer> {
  final RTCVideoRenderer _renderer = RTCVideoRenderer();
  WhepPlayer? _whep;
  VideoPlayerController? _hlsController;

  bool _rendererReady = false;
  bool _hasRemoteStream = false;
  bool _hlsReady = false;
  bool _failed = false;
  Timer? _hlsRetryTimer;
  int _hlsRetries = 0;

  static const int _maxHlsRetries = 10;

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    final whepUrl = widget.whepUrl?.trim();
    final hlsUrl = widget.hlsUrl?.trim();
    final preferHls = widget.ingestMode == 'rtmp';

    if (!preferHls && whepUrl != null && whepUrl.isNotEmpty) {
      await _startWhep(whepUrl, fallbackHls: hlsUrl);
    } else if (hlsUrl != null && hlsUrl.isNotEmpty) {
      await _startHls(hlsUrl);
    } else if (whepUrl != null && whepUrl.isNotEmpty) {
      await _startWhep(whepUrl, fallbackHls: null);
    } else {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _startWhep(String whepUrl, {String? fallbackHls}) async {
    await _renderer.initialize();
    if (!mounted) return;
    setState(() => _rendererReady = true);

    final whep = WhepPlayer();
    _whep = whep;
    whep.onRemoteStream = (stream) {
      if (!mounted) return;
      _renderer.srcObject = stream;
      setState(() => _hasRemoteStream = true);
    };
    whep.onPermanentFailure = () {
      if (!mounted) return;
      if (fallbackHls != null && fallbackHls.isNotEmpty) {
        // Ingest mode was unknown — the stream may be RTMP after all.
        unawaited(_startHls(fallbackHls));
      } else {
        setState(() => _failed = true);
      }
    };
    await whep.start(whepUrl);
  }

  Future<void> _startHls(String hlsUrl) async {
    _hlsRetryTimer?.cancel();
    final old = _hlsController;
    _hlsController = null;
    await old?.dispose();

    final controller = VideoPlayerController.networkUrl(Uri.parse(hlsUrl));
    _hlsController = controller;
    try {
      await controller.initialize();
      await controller.play();
      if (!mounted) return;
      setState(() {
        _hlsReady = true;
        _failed = false;
      });
    } catch (_) {
      // A just-started live stream can 404 briefly while Cloudflare warms up.
      if (!mounted) return;
      _hlsRetries++;
      if (_hlsRetries > _maxHlsRetries) {
        setState(() => _failed = true);
        return;
      }
      _hlsRetryTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) unawaited(_startHls(hlsUrl));
      });
    }
  }

  @override
  void dispose() {
    _hlsRetryTimer?.cancel();
    unawaited(_whep?.stop());
    _renderer.srcObject = null;
    _renderer.dispose();
    _hlsController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Widget child;
    if (_hlsReady && _hlsController != null) {
      child = FittedBox(
        fit: BoxFit.contain,
        child: SizedBox(
          width: _hlsController!.value.size.width,
          height: _hlsController!.value.size.height,
          child: VideoPlayer(_hlsController!),
        ),
      );
    } else if (_rendererReady && _hasRemoteStream) {
      child = RTCVideoView(
        _renderer,
        objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
      );
    } else if (_failed) {
      child = const Center(
        child: Text(
          'Stream unavailable. Pull to refresh or try again shortly.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70),
        ),
      );
    } else {
      child = const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 12),
            Text(
              'Connecting to stream…',
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      );
    }

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(color: Colors.black, child: child),
      ),
    );
  }
}
