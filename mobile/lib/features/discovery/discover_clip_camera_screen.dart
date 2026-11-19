import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/services/audio_player_service.dart';
import '../../widgets/camera_stage.dart';
import '../../widgets/capture_shutter.dart';

/// Full-screen selfie camera. Hold the circle to record. The clip starts after
/// the microphone is already rolling.
class DiscoverClipCameraScreen extends StatefulWidget {
  const DiscoverClipCameraScreen({
    super.key,
    required this.clipUrl,
    required this.songTitle,
    this.maxRecordSeconds = 15,
  });

  final String clipUrl;
  final String songTitle;
  final int maxRecordSeconds;

  @override
  State<DiscoverClipCameraScreen> createState() =>
      _DiscoverClipCameraScreenState();
}

class _DiscoverClipCameraScreenState extends State<DiscoverClipCameraScreen> {
  final AudioPlayer _clipPlayer = AudioPlayer(
    handleInterruptions: false,
    handleAudioSessionActivation: false,
  );

  CameraController? _camera;
  final GlobalKey<CameraStageState> _stageKey = GlobalKey<CameraStageState>();
  bool _locked = false;
  bool _stopOnRelease = false;

  Timer? _recordTimer;
  Timer? _holdTimer;
  DateTime? _recordStartedAt;
  int _pressGen = 0;
  final ValueNotifier<double> _recordProgress = ValueNotifier<double>(0);

  bool _initializing = true;
  bool _silencedRadio = false;
  bool _recording = false;
  bool _startingRecord = false;
  bool _finishing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_setup());
  }

  @override
  void dispose() {
    _holdTimer?.cancel();
    _recordTimer?.cancel();
    _recordProgress.dispose();
    unawaited(_clipPlayer.dispose());
    final cam = _camera;
    _camera = null;
    unawaited(cam?.dispose() ?? Future<void>.value());
    // Hand audio route back to music before parent unmutes radio.
    unawaited(AudioPlayerService.restoreMusicSession());
    if (_silencedRadio) {
      _silencedRadio = false;
      AudioPlayerService.handler.releaseExternalAudio();
    }
    super.dispose();
  }

  /// Silence live radio for countdown + take. Parent create-video resumes.
  /// Soft-mute alone is not enough: the music stream must hard-pause so the
  /// camera mic can start recording (iOS rejects startVideoRecording while
  /// another player still owns the session).
  Future<void> _pauseRadioForCamera() async {
    if (_silencedRadio) return;
    _silencedRadio = true;
    final handler = AudioPlayerService.handler;
    handler.holdForExternalAudio();
    try {
      await handler.hardPauseMusicForCapture();
    } catch (_) {}
    try {
      await handler.releasePlaybackForCapture();
    } catch (_) {}
  }

  Future<void> _hearRadioAgain() async {
    if (_silencedRadio) {
      _silencedRadio = false;
      try {
        await AudioPlayerService.restoreMusicSession();
      } catch (_) {}
      AudioPlayerService.handler.releaseExternalAudio();
    }
    final handler = AudioPlayerService.handler;
    if (handler.userPaused || handler.holdsExternalAudio) return;
    try {
      await AudioPlayerService().player.play();
    } catch (_) {}
  }

  Future<void> _mixRadioWithCamera() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.defaultToSpeaker |
              AVAudioSessionCategoryOptions.allowBluetooth |
              AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.defaultMode,
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
  }

  Future<void> _setup() async {
    await _mixRadioWithCamera();

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
      if (!mounted) return;
      setState(() => _initializing = false);
      await _mixRadioWithCamera();
      await _hearRadioAgain();
      unawaited(_preloadClip());
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
      // 16:9. Medium is 4:3, which looks bent when it fills the phone.
      ResolutionPreset.high,
      enableAudio: true,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    _camera = next;
    await previous?.dispose();
    await next.initialize();
    try {
      await next.lockCaptureOrientation(DeviceOrientation.portraitUp);
    } catch (_) {}
    if (!mounted) return;
    setState(() {});
  }

  bool get _isFrontCamera =>
      _camera?.description.lensDirection == CameraLensDirection.front;

  /// Android needs a Flutter-side horizontal flip for Snapchat-style selfie
  /// preview. iOS `camera_avfoundation` already sets `isVideoMirrored` on the
  /// front-camera connection — flipping again would reverse it.
  bool get _shouldFlipPreview => _isFrontCamera && !kIsWeb && !Platform.isIOS;

  Future<void> _preloadClip() async {
    try {
      await _clipPlayer.setUrl(widget.clipUrl);
      await _clipPlayer.seek(Duration.zero);
      await _clipPlayer.pause();
    } catch (_) {}
  }

  void _shutterDown() {
    if (_locked) {
      _stopOnRelease = true;
      return;
    }
    if (_initializing ||
        _recording ||
        _startingRecord ||
        _finishing ||
        _camera == null) {
      return;
    }
    final gen = ++_pressGen;
    _holdTimer?.cancel();
    _holdTimer = Timer(const Duration(milliseconds: 450), () async {
      if (!mounted || gen != _pressGen) return;
      await _beginRecording();
      if (!mounted || gen == _pressGen || _locked) return;
      if (_recording) unawaited(_finishRecording());
    });
  }

  void _lockRecording() {
    if (!_recording || _locked || _finishing) return;
    _holdTimer?.cancel();
    _pressGen++;
    setState(() => _locked = true);
  }

  void _shutterUp() {
    if (_locked) {
      if (_stopOnRelease) {
        _stopOnRelease = false;
        unawaited(_finishRecording());
      }
      return;
    }
    _holdTimer?.cancel();
    _pressGen++;
    if (_recording || _startingRecord) unawaited(_finishRecording());
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

      _recordStartedAt = DateTime.now();
      _recordProgress.value = 0;
      setState(() {
        _recording = true;
        _startingRecord = false;
      });

      // Clip audio after the camera is rolling — never block recording on it.
      unawaited(_startClipAudio());

      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
        final started = _recordStartedAt;
        if (started == null) return;
        final elapsed = DateTime.now().difference(started);
        final cap = Duration(seconds: widget.maxRecordSeconds);
        _recordProgress.value = (elapsed.inMilliseconds / cap.inMilliseconds)
            .clamp(0, 1);
        if (elapsed >= cap) {
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
      await _clipPlayer.setVolume(0.9);
      await _clipPlayer.play();
    } catch (e) {
      debugPrint('DiscoverClipCamera: clip audio failed - $e');
    }
  }

  Future<void> _finishRecording() async {
    final cam = _camera;
    if (cam == null || !_recording || _finishing) return;

    _finishing = true;
    final started = _recordStartedAt;
    setState(() {
      _finishing = true;
      _locked = false;
      _stopOnRelease = false;
    });
    _recordTimer?.cancel();
    _recordProgress.value = 0;

    try {
      await _clipPlayer.stop();
    } catch (_) {}

    try {
      final file = await cam.stopVideoRecording();
      final elapsed = started == null
          ? Duration.zero
          : DateTime.now().difference(started);
      _recordStartedAt = null;
      if (elapsed < const Duration(milliseconds: 500)) {
        await _hearRadioAgain();
        if (!mounted) return;
        setState(() {
          _finishing = false;
          _recording = false;
        });
        return;
      }
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
    _holdTimer?.cancel();
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
            CameraStage(
              key: _stageKey,
              controller: cam,
              mirror: _shouldFlipPreview,
            )
          else
            const Center(child: CircularProgressIndicator(color: Colors.white)),
          SafeArea(
            child: Stack(
              children: [
                Positioned(
                  top: 4,
                  left: 4,
                  child: IconButton(
                    onPressed: _finishing ? null : _cancel,
                    tooltip: 'Close',
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                ),
                if (_error != null)
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 128,
                    child: Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                if (ready && !_finishing)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 28,
                    child: Center(
                      child: HoldShutter(
                        progress: _recordProgress,
                        recording: _recording,
                        locked: _locked,
                        onDown: _shutterDown,
                        onUp: _shutterUp,
                        onLock: _lockRecording,
                        onZoomStart: () =>
                            _stageKey.currentState?.beginDragZoom(),
                        onZoom: (dy) => _stageKey.currentState?.dragZoom(dy),
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
