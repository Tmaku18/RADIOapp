import 'dart:async';

import 'package:audio_session/audio_session.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/theme/dimension_tokens.dart';

/// Full-screen camera: countdown on preview, then auto-starts recording when
/// the timer hits 1 while the Discover clip plays.
class DiscoverClipCameraScreen extends StatefulWidget {
  const DiscoverClipCameraScreen({
    super.key,
    required this.clipUrl,
    required this.songTitle,
    this.countdownSeconds = 10,
    this.maxRecordSeconds = 15,
  });

  final String clipUrl;
  final String songTitle;
  final int countdownSeconds;
  final int maxRecordSeconds;

  @override
  State<DiscoverClipCameraScreen> createState() =>
      _DiscoverClipCameraScreenState();
}

class _DiscoverClipCameraScreenState extends State<DiscoverClipCameraScreen> {
  final AudioPlayer _clipPlayer = AudioPlayer();

  CameraController? _camera;
  List<CameraDescription> _cameras = const [];
  int _cameraIndex = 0;

  Timer? _countdownTimer;
  Timer? _recordTimer;

  late int _remaining;
  bool _initializing = true;
  bool _recording = false;
  bool _startingRecord = false;
  bool _finishing = false;
  int _recordedSeconds = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _remaining = widget.countdownSeconds.clamp(1, 30);
    unawaited(_setup());
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _recordTimer?.cancel();
    unawaited(_clipPlayer.dispose());
    final cam = _camera;
    _camera = null;
    unawaited(cam?.dispose() ?? Future<void>.value());
    super.dispose();
  }

  Future<void> _setup() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.defaultToSpeaker |
                  AVAudioSessionCategoryOptions.allowBluetooth,
          avAudioSessionMode: AVAudioSessionMode.videoRecording,
          avAudioSessionRouteSharingPolicy:
              AVAudioSessionRouteSharingPolicy.defaultPolicy,
          avAudioSessionSetActiveOptions: AVAudioSessionSetActiveOptions.none,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.music,
            flags: AndroidAudioFlags.none,
            usage: AndroidAudioUsage.media,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
    } catch (_) {}

    try {
      final all = await availableCameras();
      if (!mounted) return;

      // Selfie-only: never open the rear camera for Discover videos.
      final frontCameras = all
          .where((c) => c.lensDirection == CameraLensDirection.front)
          .toList(growable: false);

      if (frontCameras.isEmpty) {
        setState(() {
          _initializing = false;
          _error =
              'No front camera found. Discover videos need the selfie camera.';
        });
        return;
      }

      _cameras = frontCameras;
      _cameraIndex = 0;
      await _openCamera(frontCameras.first);
      if (!mounted) return;
      if (_camera == null || !(_camera!.value.isInitialized)) {
        setState(() {
          _initializing = false;
          _error = 'Could not start the front (selfie) camera.';
        });
        return;
      }
      setState(() => _initializing = false);
      _startCountdown();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _initializing = false;
        _error = 'Could not open front camera: $e';
      });
    }
  }

  Future<void> _openCamera(CameraDescription description) async {
    // Hard-guard: Discover record is selfie-only.
    if (description.lensDirection != CameraLensDirection.front) {
      throw StateError('Discover recording requires the front camera.');
    }
    final previous = _camera;
    final next = CameraController(
      description,
      ResolutionPreset.high,
      enableAudio: true,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    _camera = next;
    await previous?.dispose();
    await next.initialize();
    if (!mounted) return;
    setState(() {});
  }

  bool get _isFrontCamera =>
      _camera?.description.lensDirection == CameraLensDirection.front;

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remaining <= 1) {
        // Already showing 1 — start recording now.
        timer.cancel();
        unawaited(_beginRecording());
        return;
      }
      final next = _remaining - 1;
      setState(() => _remaining = next);
      if (next == 1) {
        // Countdown just hit 1 — start recording immediately.
        timer.cancel();
        unawaited(_beginRecording());
      }
    });
  }

  Future<void> _beginRecording() async {
    final cam = _camera;
    if (cam == null ||
        !cam.value.isInitialized ||
        _recording ||
        _startingRecord ||
        _finishing) {
      return;
    }

    setState(() {
      _startingRecord = true;
      _remaining = 1;
      _error = null;
    });

    try {
      // Clip audio starts with the take.
      await _clipPlayer.setUrl(widget.clipUrl);
      await _clipPlayer.seek(Duration.zero);
      unawaited(_clipPlayer.play());

      await cam.startVideoRecording();
      if (!mounted) return;

      setState(() {
        _recording = true;
        _startingRecord = false;
        _recordedSeconds = 0;
      });

      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) {
          timer.cancel();
          return;
        }
        final next = _recordedSeconds + 1;
        setState(() => _recordedSeconds = next);
        if (next >= widget.maxRecordSeconds) {
          timer.cancel();
          unawaited(_finishRecording());
        }
      });
    } catch (e) {
      try {
        await _clipPlayer.stop();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _startingRecord = false;
        _recording = false;
        _error = 'Could not start recording: $e';
      });
    }
  }

  Future<void> _finishRecording() async {
    final cam = _camera;
    if (cam == null || !_recording || _finishing) return;

    setState(() => _finishing = true);
    _recordTimer?.cancel();

    try {
      await _clipPlayer.stop();
    } catch (_) {}

    try {
      final file = await cam.stopVideoRecording();
      if (!mounted) return;
      Navigator.of(context).pop(file.path);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _finishing = false;
        _recording = false;
        _error = 'Could not save recording: $e';
      });
    }
  }

  Future<void> _cancel() async {
    _countdownTimer?.cancel();
    _recordTimer?.cancel();
    try {
      await _clipPlayer.stop();
    } catch (_) {}
    final cam = _camera;
    if (cam != null && cam.value.isRecordingVideo) {
      try {
        await cam.stopVideoRecording();
      } catch (_) {}
    }
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final cam = _camera;
    final ready = cam != null && cam.value.isInitialized && !_initializing;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (ready)
            // Mirror the front camera so the preview feels like a normal selfie.
            Transform(
              alignment: Alignment.center,
              transform: _isFrontCamera
                  ? (Matrix4.identity()..scale(-1.0, 1.0, 1.0))
                  : Matrix4.identity(),
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: cam.value.previewSize?.height ?? 1,
                  height: cam.value.previewSize?.width ?? 1,
                  child: CameraPreview(cam),
                ),
              ),
            )
          else
            const Center(child: CircularProgressIndicator(color: Colors.white)),
          SafeArea(
            child: Stack(
              children: [
                Positioned(
                  top: 8,
                  left: 8,
                  child: TextButton(
                    onPressed: _finishing ? null : _cancel,
                    child: const Text(
                      'Cancel',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ),
                ),
                Positioned(
                  top: 14,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Text(
                      'Selfie',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
                if (_error != null)
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 120,
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                if (!_recording && !_startingRecord && _error == null)
                  Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'GET READY',
                          style: TextStyle(
                            color: DimensionTokens.neonCyan,
                            fontSize: 12,
                            letterSpacing: 3,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 12),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          transitionBuilder: (child, anim) {
                            return ScaleTransition(
                              scale: anim,
                              child: FadeTransition(
                                opacity: anim,
                                child: child,
                              ),
                            );
                          },
                          child: Text(
                            '$_remaining',
                            key: ValueKey(_remaining),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 96,
                              fontWeight: FontWeight.w800,
                              height: 1,
                              shadows: [
                                Shadow(
                                  blurRadius: 12,
                                  color: Colors.black54,
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _remaining == 1
                              ? 'Recording…'
                              : 'Recording starts at 1',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            widget.songTitle,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white54,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_recording || _startingRecord)
                  Positioned(
                    top: 56,
                    left: 0,
                    right: 0,
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: Colors.redAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _finishing
                                    ? 'Saving…'
                                    : 'REC  $_recordedSeconds / ${widget.maxRecordSeconds}s',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_recording && !_finishing)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 36,
                    child: Center(
                      child: FilledButton.icon(
                        onPressed: _finishRecording,
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.redAccent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 28,
                            vertical: 14,
                          ),
                        ),
                        icon: const Icon(Icons.stop),
                        label: const Text('Stop'),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
