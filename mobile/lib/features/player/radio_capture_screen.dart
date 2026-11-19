import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:video_player/video_player.dart';

import '../../core/navigation/home_tab_intent.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/services/radio_share.dart';
import '../../core/services/social_share.dart';
import '../../core/services/song_stories_service.dart';
import '../../widgets/camera_stage.dart';
import '../../widgets/capture_shutter.dart';
import 'widgets/artist_credit_sticker.dart';
import 'widgets/social_share_bar.dart';

/// Front camera on the radio player. The mic and the song are both saved
/// into the clip so the feed, Instagram, Snapchat, and TikTok can play them.
class RadioCaptureScreen extends StatefulWidget {
  const RadioCaptureScreen({
    super.key,
    required this.audioUrl,
    required this.title,
    required this.artistName,
    this.artistId,
    this.songId,
    this.stationId,
    this.durationMs,
    this.startMs,
  });

  final String audioUrl;
  final String title;
  final String artistName;
  final String? artistId;
  final String? songId;
  final String? stationId;
  final int? durationMs;

  /// Where in the full song the clip should start. When this is set, the
  /// clip does not follow the live radio playhead.
  final int? startMs;

  @override
  State<RadioCaptureScreen> createState() => _RadioCaptureScreenState();
}

enum _CapturePhase { preparing, ready, recording, mixing, review, failed }

/// Sits above the review tray so a drag on the credit is not stolen by the
/// tray's scroll view. Empty space still passes taps through to the buttons.
class _CreditDragOverlay extends StatelessWidget {
  const _CreditDragOverlay({
    required this.aspectRatio,
    required this.dx,
    required this.dy,
    required this.scale,
    required this.onMove,
  });

  final double aspectRatio;
  final double dx;
  final double dy;
  final double scale;
  final void Function(double dx, double dy) onMove;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final maxH = constraints.maxHeight;
        if (maxW <= 0 || maxH <= 0) return const SizedBox.shrink();
        final fitted = applyBoxFit(
          BoxFit.contain,
          Size(aspectRatio * 1000, 1000),
          Size(maxW, maxH),
        );
        final videoW = fitted.destination.width;
        final videoH = fitted.destination.height;
        if (videoW <= 0 || videoH <= 0) return const SizedBox.shrink();
        final left = (maxW - videoW) / 2;
        final top = (maxH - videoH) / 2;
        final hitW = videoW * 0.84 < 140 ? 140.0 : videoW * 0.84;
        final hitH = videoW * 0.34 * scale < 96 ? 96.0 : videoW * 0.34 * scale;
        return Stack(
          children: [
            Positioned(
              left: left + videoW * dx - hitW / 2,
              top: top + videoH * dy - hitH / 2,
              width: hitW,
              height: hitH,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onPanUpdate: (details) {
                  onMove(details.delta.dx / videoW, details.delta.dy / videoH);
                },
                child: const SizedBox.expand(),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _RadioCaptureScreenState extends State<RadioCaptureScreen> {
  final AudioPlayer _cue = AudioPlayer(
    handleInterruptions: false,
    handleAudioSessionActivation: false,
    androidApplyAudioAttributes: false,
  );

  final GlobalKey<CameraStageState> _stageKey = GlobalKey<CameraStageState>();
  CameraController? _camera;
  VideoPlayerController? _preview;
  bool _locked = false;
  bool _stopOnRelease = false;
  bool _flipping = false;
  Timer? _recordTimer;
  Timer? _holdTimer;
  Future<File>? _audioDownload;
  DateTime? _recordStartedAt;
  int _pressGen = 0;
  bool _holdArmed = false;
  final ValueNotifier<double> _recordProgress = ValueNotifier<double>(0);

  _CapturePhase _phase = _CapturePhase.preparing;
  String? _error;
  File? _clip;
  bool _held = false;
  bool _released = false;
  bool _posting = false;
  bool _postingStory = false;
  String _storyVisibility = 'public';
  bool _applyingCredit = false;
  ArtistCreditStyle? _creditStyle = ArtistCreditStyle.words;
  double _creditX = 0.5;
  double _creditY = 0.58;
  double _creditScale = 1;
  String? _burnKey;
  File? _burned;
  bool _stopping = false;
  int _startMs = 0;
  int? _knownDurationMs;
  int _recordStartMs = 0;
  late final TextEditingController _captionCtrl;

  @override
  void initState() {
    super.initState();
    _captionCtrl = TextEditingController(text: _songLine);
    unawaited(_setup());
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
    _holdTimer?.cancel();
    _recordProgress.dispose();
    _captionCtrl.dispose();
    final cam = _camera;
    _camera = null;
    if (cam != null) {
      if (cam.value.isRecordingVideo) {
        unawaited(cam.stopVideoRecording().then((_) {}, onError: (_) {}));
      }
      unawaited(cam.dispose());
    }
    final preview = _preview;
    _preview = null;
    unawaited(preview?.dispose() ?? Future<void>.value());
    unawaited(_releaseRadio());
    super.dispose();
  }

  /// Song line with no link. Shown in the caption box so it can be edited.
  String get _songLine {
    final artist = widget.artistId?.trim() ?? '';
    if (artist.isNotEmpty) {
      return RadioShare.artistLead(
        artistName: widget.artistName,
        songTitle: widget.title,
      );
    }
    final station = widget.stationId?.trim() ?? '';
    if (station.isNotEmpty) return RadioShare.stationLead(station);
    final name = widget.artistName.trim();
    return name.isEmpty ? widget.title : '${widget.title} — $name';
  }

  /// What gets posted. A cleared box still posts the song line, never the link.
  String get _feedCaption {
    final typed = _captionCtrl.text.trim();
    return typed.isEmpty ? _songLine : typed;
  }

  /// Share sheet keeps the link so someone can open the song.
  String get _caption {
    final artist = widget.artistId?.trim() ?? '';
    if (artist.isNotEmpty) {
      return RadioShare.artistMessage(
        artistId: artist,
        artistName: widget.artistName,
        songTitle: widget.title,
        songId: widget.songId,
      );
    }
    final station = widget.stationId?.trim() ?? '';
    if (station.isNotEmpty) return RadioShare.stationMessage(station);
    return _songLine;
  }

  Future<void> _setup() async {
    try {
      await _holdRadio();
      await _configureSession();
      await _openCamera();
      // The camera plugin resets the session category while attaching the mic.
      // Put video-recording mode back before the user holds the shutter.
      await _configureSession();
      try {
        await _camera?.prepareForVideoRecording();
      } catch (_) {}
      await _configureSession();
      _audioDownload = SocialShare.downloadToTemp(widget.audioUrl);
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.ready;
        _error = null;
      });
    } catch (error) {
      await _dropCamera();
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.failed;
        _error = _friendly(error);
      });
    }
  }

  Future<void> _dropCamera() async {
    final cam = _camera;
    _camera = null;
    if (cam == null) return;
    try {
      if (cam.value.isRecordingVideo) {
        await cam.stopVideoRecording();
      }
    } catch (_) {}
    try {
      await cam.dispose();
    } catch (_) {}
  }

  Future<void> _holdRadio() async {
    final player = AudioPlayerService().player;
    final handler = AudioPlayerService.handler;
    final chosen = widget.startMs;
    if (chosen != null) {
      _startMs = chosen < 0 ? 0 : chosen;
      _knownDurationMs = widget.durationMs;
    } else {
      try {
        _startMs = player.position.inMilliseconds;
        _knownDurationMs = player.duration?.inMilliseconds ?? widget.durationMs;
      } catch (_) {
        _startMs = 0;
        _knownDurationMs = widget.durationMs;
      }
      if (_startMs < 0) _startMs = 0;
    }
    // Set the hold before any await so a live-sync tick cannot start the
    // station again while the camera is coming up.
    if (!_held) {
      handler.holdForExternalAudio();
      _held = true;
    }
    try {
      await handler.reassertExternalSilence();
    } catch (_) {}
    try {
      await handler.hardPauseMusicForCapture();
    } catch (_) {}
    try {
      await handler.releasePlaybackForCapture();
    } catch (_) {}
  }

  Future<void> _releaseRadio() async {
    if (!_held || _released) return;
    _released = true;
    try {
      await _cue.dispose();
    } catch (_) {}
    try {
      await AudioPlayerService.restoreMusicSession();
    } catch (_) {}
    AudioPlayerService.handler.releaseExternalAudio();
  }

  Future<void> _configureSession() async {
    final session = await AudioSession.instance;
    try {
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.defaultToSpeaker |
              AVAudioSessionCategoryOptions.allowBluetooth |
              AVAudioSessionCategoryOptions.mixWithOthers,
          // videoRecording mode will not play audio at the same time. The song
          // cue and the finished clip then die, and the take never finishes.
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
    } catch (_) {}
    try {
      await session.setActive(true);
    } catch (_) {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      try {
        await session.setActive(true);
      } catch (_) {}
    }
  }

  Future<void> _openCamera([
    CameraLensDirection facing = CameraLensDirection.front,
  ]) async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) {
      throw Exception('Allow camera access to record');
    }
    var chosen = cameras.first;
    for (final cam in cameras) {
      if (cam.lensDirection == facing) {
        chosen = cam;
        break;
      }
    }
    final camera = CameraController(
      chosen,
      // 16:9. The medium preset is 4:3, and stretching that to the phone
      // bows the picture.
      ResolutionPreset.high,
      enableAudio: true,
    );
    _camera = camera;
    try {
      await camera.initialize();
      try {
        await camera.lockCaptureOrientation(DeviceOrientation.portraitUp);
      } catch (_) {}
    } catch (error) {
      _camera = null;
      try {
        await camera.dispose();
      } catch (_) {}
      rethrow;
    }
    if (!mounted) return;
    setState(() {});
  }

  Future<void> _flipCamera() async {
    final current = _camera;
    if (_flipping || current == null || _phase != _CapturePhase.ready) return;
    final wasFront =
        current.description.lensDirection == CameraLensDirection.front;
    final facing = wasFront
        ? CameraLensDirection.back
        : CameraLensDirection.front;
    setState(() {
      _flipping = true;
      _error = null;
    });
    try {
      final cameras = await availableCameras();
      if (!cameras.any((c) => c.lensDirection == facing)) return;
      setState(() => _camera = null);
      try {
        await current.dispose();
      } catch (_) {}
      try {
        await _openCamera(facing);
      } catch (_) {
        await _openCamera(current.description.lensDirection);
      }
      await _configureSession();
      try {
        await _camera?.prepareForVideoRecording();
      } catch (_) {}
      await _configureSession();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        if (_camera == null) _phase = _CapturePhase.failed;
        _error = _friendly(error);
      });
    } finally {
      if (mounted) setState(() => _flipping = false);
    }
  }

  Future<void> _startCue() async {
    try {
      if (_cue.audioSource == null) {
        await _cue.setUrl(widget.audioUrl);
      }
      await _cue.seek(Duration(milliseconds: _recordStartMs));
      await _cue.setVolume(0.9);
      await _cue.play();
    } catch (_) {}
  }

  int _lengthFrom(int startMs) {
    final total = _knownDurationMs;
    if (total == null || total <= startMs) return SocialShare.clipMs;
    final remain = total - startMs;
    if (remain < 1000) return 1000;
    if (remain > SocialShare.clipMs) return SocialShare.clipMs;
    return remain;
  }

  Future<File> _songFile() async {
    final pending = _audioDownload;
    if (pending == null) {
      throw Exception('Could not download the song');
    }
    return pending;
  }

  void _shutterDown() {
    if (_locked) {
      _stopOnRelease = true;
      return;
    }
    if (_phase != _CapturePhase.ready || _stopping || _flipping) return;
    final gen = ++_pressGen;
    _holdArmed = false;
    _holdTimer?.cancel();
    _holdTimer = Timer(const Duration(milliseconds: 450), () async {
      if (!mounted || gen != _pressGen) return;
      _holdArmed = true;
      await _startVideo();
      if (!mounted || gen == _pressGen || _locked) return;
      if (_phase == _CapturePhase.recording) unawaited(_stopVideo());
    });
  }

  void _lockRecording() {
    if (_phase != _CapturePhase.recording || _locked) return;
    _holdTimer?.cancel();
    _pressGen++;
    _holdArmed = false;
    setState(() => _locked = true);
  }

  void _shutterUp() {
    if (_locked) {
      if (_stopOnRelease) {
        _stopOnRelease = false;
        unawaited(_stopVideo());
      }
      return;
    }
    _holdTimer?.cancel();
    final armed = _holdArmed;
    _pressGen++;
    _holdArmed = false;
    if (armed || _phase == _CapturePhase.recording) {
      unawaited(_stopVideo());
      return;
    }
    if (_phase == _CapturePhase.ready) unawaited(_takePhoto());
  }

  Future<void> _takePhoto() async {
    final cam = _camera;
    if (cam == null ||
        !cam.value.isInitialized ||
        _phase != _CapturePhase.ready) {
      return;
    }
    setState(() => _phase = _CapturePhase.mixing);
    try {
      final shot = await cam.takePicture();
      try {
        final song = await _songFile();
        final out = await SocialShare.imageWithAudio(
          imagePath: shot.path,
          audioPath: song.path,
          startMs: _startMs,
          durationMs: _lengthFrom(_startMs),
        );
        await _showClip(File(out));
      } catch (error) {
        if (!mounted) return;
        setState(() {
          _phase = _CapturePhase.ready;
          _error = _friendly(error);
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.ready;
        _error = _friendly(error);
      });
    }
  }

  Future<void> _startVideo() async {
    final cam = _camera;
    if (cam == null ||
        !cam.value.isInitialized ||
        _phase != _CapturePhase.ready) {
      return;
    }
    try {
      _recordStartMs = _startMs;
      try {
        await cam.prepareForVideoRecording();
      } catch (_) {}
      await _configureSession();
      await cam.startVideoRecording();
      _recordStartedAt = DateTime.now();
      _recordProgress.value = 0;
      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
        final started = _recordStartedAt;
        if (started == null) return;
        final elapsed = DateTime.now().difference(started);
        final cap = Duration(milliseconds: SocialShare.clipMs);
        _recordProgress.value = (elapsed.inMilliseconds / cap.inMilliseconds)
            .clamp(0, 1);
        if (elapsed >= cap) {
          timer.cancel();
          unawaited(_stopVideo());
        }
      });
      if (!mounted) return;
      setState(() => _phase = _CapturePhase.recording);
      unawaited(_startCue());
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendly(error));
    }
  }

  Future<void> _stopVideo() async {
    if (_stopping) return;
    _stopping = true;
    _recordTimer?.cancel();
    _locked = false;
    _stopOnRelease = false;
    final cam = _camera;
    final started = _recordStartedAt;
    if (cam == null || !cam.value.isRecordingVideo) {
      _stopping = false;
      _recordStartedAt = null;
      if (mounted) setState(() {});
      return;
    }
    if (mounted) {
      setState(() => _phase = _CapturePhase.mixing);
      _recordProgress.value = 0;
    }
    try {
      await _cue.pause();
    } catch (_) {}
    try {
      final recorded = await cam.stopVideoRecording();
      final elapsed = started == null
          ? Duration.zero
          : DateTime.now().difference(started);
      _recordStartedAt = null;
      if (elapsed < const Duration(milliseconds: 500)) {
        if (!mounted) return;
        setState(() => _phase = _CapturePhase.ready);
        return;
      }
      File clip;
      String? warning;
      try {
        final song = await _songFile();
        final out = await SocialShare.attachAudio(
          videoPath: recorded.path,
          audioPath: song.path,
          startMs: _recordStartMs,
          durationMs: _lengthFrom(_recordStartMs),
        );
        clip = File(out);
      } catch (error) {
        warning = _friendly(error);
        clip = await _playableCopy(File(recorded.path));
      }
      await _showClip(clip, warning: warning);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.ready;
        _error = _friendly(error);
      });
    } finally {
      _stopping = false;
    }
  }

  Future<File> _playableCopy(File recorded) async {
    try {
      final cleaned = await SocialShare.makePlayable(recorded.path);
      final file = File(cleaned);
      if (await file.exists() && await file.length() > 1000) return file;
    } catch (_) {}
    return recorded;
  }

  Future<VideoPlayerController?> _openClipFile(File file) async {
    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      final next = VideoPlayerController.file(file);
      try {
        await next.initialize().timeout(const Duration(seconds: 6));
        return next;
      } catch (error) {
        lastError = error;
        try {
          await next.dispose();
        } catch (_) {}
        await Future<void>.delayed(Duration(milliseconds: 250 * (attempt + 1)));
      }
    }
    if (lastError != null) {
      debugPrint('RadioCapture preview: $lastError');
    }
    return null;
  }

  Future<void> _showClip(File file, {String? warning}) async {
    try {
      await _cue.pause();
    } catch (_) {}
    // Opening the file while the camera session is still up works. Switching
    // to a music-only session first is what made the preview fail.
    var controller = await _openClipFile(file);
    if (controller == null) {
      try {
        final session = await AudioSession.instance;
        await session.configure(const AudioSessionConfiguration.music());
        await session.setActive(true);
        await AudioPlayerService.handler.reassertExternalSilence();
      } catch (_) {}
      controller = await _openClipFile(file);
    }
    if (controller == null) {
      final saved = await file.exists() && await file.length() > 1000;
      if (!saved) {
        throw Exception('Could not play the clip');
      }
      _clip = file;
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.review;
        _error =
            warning ?? 'The clip is saved, but the preview could not start.';
      });
      return;
    }
    await controller.setLooping(true);
    await controller.setVolume(1);
    try {
      await controller.play();
    } catch (_) {}
    await AudioPlayerService.handler.reassertExternalSilence();
    final previous = _preview;
    _preview = controller;
    _clip = file;
    await previous?.dispose();
    if (!mounted) return;
    setState(() {
      _phase = _CapturePhase.review;
      _error = warning;
    });
  }

  Future<void> _retake() async {
    final previous = _preview;
    _preview = null;
    _clip = null;
    _burned = null;
    _burnKey = null;
    await previous?.dispose();
    try {
      await _cue.pause();
    } catch (_) {}
    try {
      await _configureSession();
    } catch (_) {}
    await AudioPlayerService.handler.reassertExternalSilence();
    if (!mounted) return;
    setState(() {
      _phase = _CapturePhase.ready;
      _error = null;
    });
  }

  String get _creditKey =>
      '${_creditStyle?.name}|${_creditX.toStringAsFixed(3)}|${_creditY.toStringAsFixed(3)}|$_creditScale';

  Future<File> _clipWithCredit() async {
    final source = _clip;
    if (source == null) throw Exception('Record a clip first');
    final style = _creditStyle;
    if (style == null) return source;
    final cached = _burned;
    if (_burnKey == _creditKey && cached != null && await cached.exists()) {
      return cached;
    }
    final aspect = _preview?.value.aspectRatio ?? (9 / 16);
    final png = await ArtistCreditPainter.renderPng(
      title: widget.title,
      artist: widget.artistName,
      style: style,
      dx: _creditX,
      dy: _creditY,
      scale: _creditScale,
      aspect: aspect,
    );
    final out = await SocialShare.burnOverlay(
      videoPath: source.path,
      overlayPath: png.path,
    );
    final file = File(out);
    _burned = file;
    _burnKey = _creditKey;
    return file;
  }

  Future<void> _post() async {
    if (_clip == null || _posting || _applyingCredit) return;
    setState(() {
      _posting = true;
      _applyingCredit = _creditStyle != null;
      _error = null;
    });
    try {
      final file = await _clipWithCredit();
      await ProNetworxService().createFeedPostViaStorage(
        file,
        caption: _feedCaption,
        kind: FeedMediaKind.video,
      );
      if (!mounted) return;
      SocialFeedRefresh.request();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Posted to your feed with this song.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendly(error));
    } finally {
      if (mounted) {
        setState(() {
          _posting = false;
          _applyingCredit = false;
        });
      }
    }
  }

  Future<void> _postStory() async {
    final songId = widget.songId;
    if (_clip == null ||
        _postingStory ||
        _applyingCredit ||
        !SongStoriesService.isSongId(songId)) {
      return;
    }
    setState(() {
      _postingStory = true;
      _applyingCredit = _creditStyle != null;
      _error = null;
    });
    try {
      final file = await _clipWithCredit();
      final artist = widget.artistName.trim();
      await SongStoriesService().postClip(
        file: file,
        songId: songId!,
        visibility: _storyVisibility,
        caption: artist.isEmpty ? widget.title : '${widget.title} — $artist',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _storyVisibility == 'hidden'
                ? 'Hidden story posted. Only you can see it, for 24 hours.'
                : _storyVisibility == 'private'
                ? 'Private story posted. Friends can see it, for 24 hours.'
                : 'Story posted. It shows on the radio while this song plays, for 24 hours.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendly(error));
    } finally {
      if (mounted) {
        setState(() {
          _postingStory = false;
          _applyingCredit = false;
        });
      }
    }
  }

  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('live stream')) {
      return 'This live stream cannot be saved into a clip.';
    }
    if (text.contains('credit')) {
      return 'Could not add the artist credit.';
    }
    if (text.contains('download') ||
        text.contains('song') ||
        text.contains('Socket') ||
        text.contains('ClientException') ||
        text.contains('Connection') ||
        text.contains('Timeout') ||
        text.contains('timed out')) {
      return 'Could not add the song to this clip.';
    }
    if (text.contains('microphone') ||
        text.contains('Microphone') ||
        text.contains('AudioAccess')) {
      return 'Allow the microphone so your voice is saved with the song.';
    }
    if (text.contains('denied') ||
        text.contains('Denied') ||
        text.contains('not authorized') ||
        text.contains('Permission')) {
      return 'Allow camera and microphone access to record.';
    }
    if (text.contains('camera') || text.contains('Camera')) {
      return 'The camera could not start. Try again.';
    }
    if (text.contains('Session activation') ||
        text.contains('setActive') ||
        text.contains('AVAudioSession') ||
        text.contains('audio unit')) {
      return 'The radio was still using the speaker. Try again.';
    }
    if (text.contains('AVAssetWriter') ||
        text.contains('not recording') ||
        text.contains('Setup Writer') ||
        text.contains('no picture') ||
        text.contains('Could not play') ||
        text.contains('Failed to load')) {
      return 'That recording did not save. Hold the button a little longer and try again.';
    }
    if (text.contains('401') ||
        text.contains('403') ||
        text.contains('Unauthorized') ||
        text.contains('sign in') ||
        text.contains('Sign in')) {
      return 'Sign in to post this to your feed. You can still share the clip.';
    }
    if (text.contains('Null check') || text.contains('is not a subtype')) {
      return 'The camera could not start. Try again.';
    }
    return 'Could not finish that clip. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    final cam = _camera;
    final preview = _preview;
    final mirror =
        Platform.isAndroid &&
        cam?.description.lensDirection == CameraLensDirection.front;
    return Scaffold(
      backgroundColor: Colors.black,
      body: _phase == _CapturePhase.failed
            ? SafeArea(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _message(_error ?? 'Could not open the camera.'),
                  Positioned(
                    top: 4,
                    left: 4,
                    child: IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      tooltip: 'Close',
                      icon: const Icon(Icons.close, color: Colors.white),
                    ),
                  ),
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 32,
                    child: FilledButton(
                      onPressed: () {
                        setState(() {
                          _phase = _CapturePhase.preparing;
                          _error = null;
                        });
                        unawaited(_setup());
                      },
                      child: const Text('Try again'),
                    ),
                  ),
                ],
              ),
            )
          : Stack(
              fit: StackFit.expand,
              children: [
                _phase == _CapturePhase.review &&
                        preview != null &&
                        preview.value.isInitialized
                    ? Center(
                        child: AspectRatio(
                          aspectRatio: preview.value.aspectRatio == 0
                              ? 9 / 16
                              : preview.value.aspectRatio,
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              return Stack(
                                fit: StackFit.expand,
                                children: [
                                  GestureDetector(
                                    onPanUpdate: (details) {
                                      final width = constraints.maxWidth;
                                      final height = constraints.maxHeight;
                                      if (width <= 0 || height <= 0) return;
                                      if (_creditStyle == null) return;
                                      setState(() {
                                        _creditX =
                                            (_creditX +
                                                    details.delta.dx / width)
                                                .clamp(0.12, 0.88);
                                        _creditY =
                                            (_creditY +
                                                    details.delta.dy / height)
                                                .clamp(0.12, 0.88);
                                      });
                                    },
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        VideoPlayer(preview),
                                        if (_creditStyle != null)
                                          IgnorePointer(
                                            child: CustomPaint(
                                              painter: ArtistCreditPainter(
                                                title: widget.title,
                                                artist: widget.artistName,
                                                style: _creditStyle!,
                                                dx: _creditX,
                                                dy: _creditY,
                                                scale: _creditScale,
                                              ),
                                            ),
                                          ),
                                            Positioned(
                                              right: 12,
                                              top: 12,
                                          child: IconButton.filled(
                                            style: IconButton.styleFrom(
                                              backgroundColor: Colors.black54,
                                              foregroundColor: Colors.white,
                                            ),
                                            tooltip: preview.value.isPlaying
                                                ? 'Pause'
                                                : 'Play',
                                            onPressed: () {
                                              if (preview.value.isPlaying) {
                                                preview.pause();
                                              } else {
                                                preview.setVolume(1);
                                                preview.play();
                                                unawaited(
                                                  AudioPlayerService.handler
                                                      .reassertExternalSilence(),
                                                );
                                              }
                                              setState(() {});
                                            },
                                            icon: Icon(
                                              preview.value.isPlaying
                                                  ? Icons.pause_rounded
                                                  : Icons.play_arrow_rounded,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      )
                    : cam != null && cam.value.isInitialized
                    ? CameraStage(
                        key: _stageKey,
                        controller: cam,
                        mirror: mirror,
                      )
                    : const Center(child: CircularProgressIndicator()),
                SafeArea(child: _chrome()),
                if (_phase == _CapturePhase.review &&
                    preview != null &&
                    preview.value.isInitialized &&
                    _creditStyle != null)
                  Positioned.fill(
                    child: _CreditDragOverlay(
                      aspectRatio: preview.value.aspectRatio == 0
                          ? 9 / 16
                          : preview.value.aspectRatio,
                      dx: _creditX,
                      dy: _creditY,
                      scale: _creditScale,
                      onMove: (dx, dy) {
                        setState(() {
                          _creditX = (_creditX + dx).clamp(0.12, 0.88);
                          _creditY = (_creditY + dy).clamp(0.12, 0.88);
                        });
                      },
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _message(String text) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
    );
  }

  Widget _chrome() {
    final reviewing = _phase == _CapturePhase.review;
    final capturing =
        _phase == _CapturePhase.ready || _phase == _CapturePhase.recording;
    return Stack(
      children: [
        Positioned(
          top: 4,
          left: 4,
          child: IconButton(
            onPressed: () => Navigator.of(context).maybePop(),
            tooltip: 'Close',
            icon: const Icon(Icons.close, color: Colors.white),
          ),
        ),
        if (_phase == _CapturePhase.ready && _camera != null && !_flipping)
          Positioned(
            top: 4,
            right: 4,
            child: IconButton(
              onPressed: _flipCamera,
              tooltip: 'Flip camera',
              icon: const Icon(
                Icons.flip_camera_ios_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
          ),
        if (_phase == _CapturePhase.mixing)
          const Center(child: CircularProgressIndicator()),
        if (_error != null && !reviewing)
          Positioned(
            left: 24,
            right: 24,
            bottom: 128,
            child: Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
            ),
          ),
        if (capturing)
          Positioned(
            left: 0,
            right: 0,
            bottom: 28,
            child: Center(
              child: HoldShutter(
                progress: _recordProgress,
                recording: _phase == _CapturePhase.recording,
                locked: _locked,
                onDown: _shutterDown,
                onUp: _shutterUp,
                onLock: _lockRecording,
                onZoomStart: () => _stageKey.currentState?.beginDragZoom(),
                onZoom: (dy) => _stageKey.currentState?.dragZoom(dy),
              ),
            ),
          ),
        if (reviewing)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * 0.42,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.9),
                    ],
                  ),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 28, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ArtistCreditTray(
                        style: _creditStyle,
                        scale: _creditScale,
                        onStyle: _applyingCredit
                            ? (_) {}
                            : (value) => setState(() => _creditStyle = value),
                        onScale: _applyingCredit
                            ? (_) {}
                            : (value) => setState(() => _creditScale = value),
                      ),
                      const SizedBox(height: 10),
                      if (_applyingCredit)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Adding the artist credit…',
                            style: TextStyle(fontSize: 12, color: Colors.white),
                          ),
                        ),
                      _reviewActions(),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _reviewActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _captionCtrl,
          enabled: !_posting && !_postingStory,
          minLines: 2,
          maxLines: 4,
          maxLength: 280,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            labelText: 'Caption',
            hintText: 'Write a caption',
            helperText: 'Clear this to post the song line without a link.',
            helperMaxLines: 2,
            labelStyle: const TextStyle(color: Colors.white70),
            hintStyle: const TextStyle(color: Colors.white38),
            helperStyle: const TextStyle(color: Colors.white54, fontSize: 11),
            counterStyle: const TextStyle(color: Colors.white38),
            filled: true,
            fillColor: Colors.white10,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Colors.white24),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Colors.white24),
            ),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _posting || _postingStory ? null : _post,
          child: Text(_posting ? 'Posting…' : 'Post to feed'),
        ),
        if (SongStoriesService.isSongId(widget.songId)) ...[
          const SizedBox(height: 8),
          const Text(
            'Who can see this story',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            children: [
              for (final option in const [
                ('public', 'Public'),
                ('private', 'Private'),
                ('hidden', 'Hidden'),
              ])
                ChoiceChip(
                  label: Text(option.$2),
                  selected: _storyVisibility == option.$1,
                  onSelected: _postingStory
                      ? null
                      : (_) => setState(() => _storyVisibility = option.$1),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            _storyVisibility == 'hidden'
                ? 'Hidden. Only you can see it. Lasts 24 hours.'
                : _storyVisibility == 'private'
                ? 'Private. Friends can see it. Lasts 24 hours.'
                : 'Public. Shows on the radio while this song plays. Lasts 24 hours.',
            style: const TextStyle(fontSize: 12),
          ),
          OutlinedButton(
            onPressed: _posting || _postingStory ? null : _postStory,
            child: Text(_postingStory ? 'Posting story…' : 'Post as story'),
          ),
        ],
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _posting || _postingStory ? null : _retake,
          child: const Text('Retake'),
        ),
        const SizedBox(height: 12),
        SocialShareBar(caption: _caption, resolveFile: _clipWithCredit),
      ],
    );
  }
}
