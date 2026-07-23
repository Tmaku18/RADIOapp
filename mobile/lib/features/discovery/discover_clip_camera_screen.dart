import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/services/audio_player_service.dart';
import '../../core/theme/dimension_tokens.dart';

/// Full-screen camera: silent countdown on preview, then starts recording +
/// Discover clip audio only after the countdown fully ends.
class DiscoverClipCameraScreen extends StatefulWidget {
  const DiscoverClipCameraScreen({
    super.key,
    required this.clipUrl,
    required this.songTitle,
    this.countdownSeconds = 5,
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

  Timer? _countdownTimer;
  Timer? _countdownEndTimer;
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
    _countdownEndTimer?.cancel();
    _recordTimer?.cancel();
    unawaited(_clipPlayer.dispose());
    final cam = _camera;
    _camera = null;
    unawaited(cam?.dispose() ?? Future<void>.value());
    // Hand audio route back to music before parent unmutes radio.
    unawaited(AudioPlayerService.restoreMusicSession());
    super.dispose();
  }

  /// Silence live radio for countdown + take. Parent create-video resumes.
  /// Soft-mute alone is not enough: the music stream must hard-pause so the
  /// camera mic can start recording (iOS rejects startVideoRecording while
  /// another player still owns the session).
  Future<void> _pauseRadioForCamera() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
      }
    } catch (_) {}
    try {
      await AudioPlayerService().player.pause();
    } catch (_) {}
  }

  Future<void> _setup() async {
    await _pauseRadioForCamera();

    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.defaultToSpeaker |
                  AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.mixWithOthers,
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
      await session.setActive(true);
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

      await _openCamera(frontCameras.first);
      if (!mounted) return;
      if (_camera == null || !(_camera!.value.isInitialized)) {
        setState(() {
          _initializing = false;
          _error = 'Could not start the front (selfie) camera.';
        });
        return;
      }
      // Preload clip silently so playback can start exactly when recording does.
      try {
        await _clipPlayer.setUrl(widget.clipUrl);
        await _clipPlayer.seek(Duration.zero);
        await _clipPlayer.pause();
      } catch (_) {
        // Non-fatal: _beginRecording will retry setUrl.
      }
      if (!mounted) return;
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
      // Medium keeps ~15s phone takes under typical edge/proxy body limits.
      ResolutionPreset.medium,
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

  /// Android needs a Flutter-side horizontal flip for Snapchat-style selfie
  /// preview. iOS `camera_avfoundation` already sets `isVideoMirrored` on the
  /// front-camera connection — flipping again would reverse it.
  bool get _shouldFlipPreview =>
      _isFrontCamera && !kIsWeb && !Platform.isIOS;

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownEndTimer?.cancel();
    final total = _remaining;
    // Tick UI every second; fire recording with a single end timer so a missed
    // periodic tick can't leave us stuck on "1".
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_remaining <= 1) {
        timer.cancel();
        return;
      }
      setState(() => _remaining = _remaining - 1);
    });
    _countdownEndTimer = Timer(Duration(seconds: total), () {
      if (!mounted || _recording || _startingRecord || _finishing) return;
      _countdownTimer?.cancel();
      unawaited(_beginRecording());
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
    if (cam.value.isRecordingVideo) {
      if (mounted) {
        setState(() {
          _recording = true;
          _startingRecord = false;
        });
      }
      return;
    }

    setState(() {
      _startingRecord = true;
      _remaining = 0;
      _error = null;
    });

    try {
      // Radio must be hard-paused so the mic session can start.
      await _pauseRadioForCamera();

      // iOS: prepare first — otherwise startVideoRecording often no-ops/fails
      // right after the countdown.
      try {
        await cam.prepareForVideoRecording();
      } catch (_) {}

      await cam.startVideoRecording();
      if (!mounted) return;

      setState(() {
        _recording = true;
        _startingRecord = false;
        _recordedSeconds = 0;
      });

      // Clip audio after the camera is rolling — never block recording on it.
      unawaited(_startClipAudio());

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
        _error =
            'Could not start recording. Check camera/mic permission and try again.\n$e';
      });
    }
  }

  Future<void> _startClipAudio() async {
    try {
      if (_clipPlayer.audioSource == null) {
        await _clipPlayer
            .setUrl(widget.clipUrl)
            .timeout(const Duration(seconds: 8));
      }
      await _clipPlayer.seek(Duration.zero);
      await _clipPlayer.play();
    } catch (e) {
      debugPrint('DiscoverClipCamera: clip audio failed - $e');
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
      // iOS front-camera capture already mirrors via isVideoMirrored, so the
      // file matches the Snapchat-style preview without a post-record flip.
      final path = file.path;
      try {
        await AudioPlayerService.restoreMusicSession();
      } catch (_) {}
      if (!mounted) return;
      Navigator.of(context).pop(path);
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
    _countdownEndTimer?.cancel();
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
    try {
      await AudioPlayerService.restoreMusicSession();
    } catch (_) {}
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
            // Snapchat-style selfie: flip on Android only (iOS is native-mirrored).
            SizedBox.expand(
              child: FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: cam.value.previewSize?.height ?? 1,
                  height: cam.value.previewSize?.width ?? 1,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()
                      ..scaleByDouble(_shouldFlipPreview ? -1.0 : 1.0, 1.0, 1.0, 1.0),
                    child: CameraPreview(cam),
                  ),
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
                          _remaining <= 1
                              ? 'Get ready…'
                              : 'Music starts when recording begins',
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
