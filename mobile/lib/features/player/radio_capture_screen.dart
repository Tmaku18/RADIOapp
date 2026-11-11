import 'dart:async';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:video_player/video_player.dart';

import '../../core/navigation/home_tab_intent.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/services/radio_share.dart';
import '../../core/services/social_share.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import 'widgets/social_share_bar.dart';

/// Front camera on the radio player. The mic stays off. The song that is on
/// is played into the headphones or speaker and then saved into the file so
/// the feed, Instagram, Snapchat, and TikTok can play it.
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

class _RadioCaptureScreenState extends State<RadioCaptureScreen> {
  final AudioPlayer _cue = AudioPlayer(
    handleInterruptions: false,
    handleAudioSessionActivation: false,
    androidApplyAudioAttributes: false,
  );

  CameraController? _camera;
  VideoPlayerController? _preview;
  Timer? _recordTimer;
  Future<File>? _audioDownload;

  _CapturePhase _phase = _CapturePhase.preparing;
  String? _error;
  File? _clip;
  bool _wasAudible = false;
  bool _held = false;
  bool _released = false;
  bool _posting = false;
  bool _stopping = false;
  int _startMs = 0;
  int? _knownDurationMs;
  int _recordStartMs = 0;
  int _recordedSeconds = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_setup());
  }

  @override
  void dispose() {
    _recordTimer?.cancel();
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
    final name = widget.artistName.trim();
    return name.isEmpty ? widget.title : '${widget.title} — $name';
  }

  Future<void> _setup() async {
    try {
      await _holdRadio();
      await _configureSession();
      await _openCamera();
      _audioDownload = SocialShare.downloadToTemp(widget.audioUrl);
      await _startCue();
      if (!mounted) return;
      setState(() => _phase = _CapturePhase.ready);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = _CapturePhase.failed;
        _error = _friendly(error);
      });
    }
  }

  Future<void> _holdRadio() async {
    final player = AudioPlayerService().player;
    final handler = AudioPlayerService.handler;
    _wasAudible = player.playing && !handler.userPaused;
    final chosen = widget.startMs;
    if (chosen != null) {
      _startMs = chosen < 0 ? 0 : chosen;
      _knownDurationMs = widget.durationMs;
    } else {
      _startMs = player.position.inMilliseconds;
      if (_startMs < 0) _startMs = 0;
      _knownDurationMs = player.duration?.inMilliseconds ?? widget.durationMs;
    }
    await handler.hardPauseMusicForCapture();
    _held = true;
    try {
      await handler.setUserPaused(true);
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
    try {
      final handler = AudioPlayerService.handler;
      if (_wasAudible) {
        await handler.setUserPaused(false);
      } else {
        await handler.music.play();
        if (handler.userPaused) await handler.music.setVolume(0);
      }
    } catch (_) {}
  }

  Future<void> _configureSession() async {
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
  }

  Future<void> _openCamera() async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) {
      throw Exception('Allow camera access to record');
    }
    var chosen = cameras.first;
    for (final cam in cameras) {
      if (cam.lensDirection == CameraLensDirection.front) {
        chosen = cam;
        break;
      }
    }
    final camera = CameraController(
      chosen,
      ResolutionPreset.medium,
      enableAudio: false,
    );
    _camera = camera;
    await camera.initialize();
    if (!mounted) return;
    setState(() {});
  }

  Future<void> _startCue() async {
    try {
      await _cue.setUrl(widget.audioUrl);
      if (_startMs > 0) await _cue.seek(Duration(milliseconds: _startMs));
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

  Future<void> _takePhoto() async {
    final cam = _camera;
    if (cam == null || !cam.value.isInitialized || _phase != _CapturePhase.ready) {
      return;
    }
    setState(() => _phase = _CapturePhase.mixing);
    try {
      final at = _cue.position.inMilliseconds;
      final start = at > 0 ? at : _startMs;
      final shot = await cam.takePicture();
      final song = await _songFile();
      final out = await SocialShare.imageWithAudio(
        imagePath: shot.path,
        audioPath: song.path,
        startMs: start,
        durationMs: _lengthFrom(start),
      );
      await _showClip(File(out));
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
    if (cam == null || !cam.value.isInitialized || _phase != _CapturePhase.ready) {
      return;
    }
    try {
      final at = _cue.position.inMilliseconds;
      _recordStartMs = at > 0 ? at : _startMs;
      await cam.startVideoRecording();
      _recordedSeconds = 0;
      _recordTimer?.cancel();
      _recordTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        setState(() => _recordedSeconds += 1);
        if (_recordedSeconds >= SocialShare.clipMs ~/ 1000) {
          timer.cancel();
          unawaited(_stopVideo());
        }
      });
      if (!mounted) return;
      setState(() => _phase = _CapturePhase.recording);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendly(error));
    }
  }

  Future<void> _stopVideo() async {
    if (_stopping) return;
    _stopping = true;
    _recordTimer?.cancel();
    final cam = _camera;
    if (cam == null || !cam.value.isRecordingVideo) {
      _stopping = false;
      return;
    }
    if (mounted) setState(() => _phase = _CapturePhase.mixing);
    try {
      final recorded = await cam.stopVideoRecording();
      final song = await _songFile();
      final out = await SocialShare.attachAudio(
        videoPath: recorded.path,
        audioPath: song.path,
        startMs: _recordStartMs,
        durationMs: _lengthFrom(_recordStartMs),
      );
      await _showClip(File(out));
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

  Future<void> _showClip(File file) async {
    try {
      await _cue.pause();
    } catch (_) {}
    final controller = VideoPlayerController.file(file);
    await controller.initialize();
    await controller.setLooping(true);
    await controller.play();
    final previous = _preview;
    _preview = controller;
    _clip = file;
    await previous?.dispose();
    if (!mounted) return;
    setState(() {
      _phase = _CapturePhase.review;
      _error = null;
    });
  }

  Future<void> _retake() async {
    final previous = _preview;
    _preview = null;
    _clip = null;
    await previous?.dispose();
    try {
      await _cue.seek(Duration(milliseconds: _startMs));
      await _cue.play();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _phase = _CapturePhase.ready;
      _error = null;
    });
  }

  Future<void> _post() async {
    final file = _clip;
    if (file == null || _posting) return;
    setState(() {
      _posting = true;
      _error = null;
    });
    try {
      await ProNetworxService().createFeedPostViaStorage(
        file,
        caption: _caption,
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
      if (mounted) setState(() => _posting = false);
    }
  }

  String _friendly(Object error) {
    final text = error.toString();
    if (text.contains('live stream')) {
      return 'This live stream cannot be saved into a clip.';
    }
    if (text.contains('download') || text.contains('song')) {
      return 'Could not add the song to this clip.';
    }
    if (text.contains('camera') || text.contains('Camera')) {
      return 'Allow camera access to record.';
    }
    if (text.contains('401') ||
        text.contains('403') ||
        text.contains('Unauthorized') ||
        text.contains('sign in') ||
        text.contains('Sign in')) {
      return 'Sign in to post this to your feed. You can still share the clip.';
    }
    return 'Could not finish that clip. Try again.';
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final cam = _camera;
    final preview = _preview;
    final mirror = Platform.isAndroid &&
        cam?.description.lensDirection == CameraLensDirection.front;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Record with this song'),
      ),
      body: SafeArea(
        child: _phase == _CapturePhase.failed
            ? _message(_error ?? 'Could not open the camera.')
            : Column(
                children: [
                  Expanded(
                    child: _phase == _CapturePhase.review &&
                            preview != null &&
                            preview.value.isInitialized
                        ? Center(
                            child: AspectRatio(
                              aspectRatio: preview.value.aspectRatio,
                              child: VideoPlayer(preview),
                            ),
                          )
                        : cam != null && cam.value.isInitialized
                            ? ClipRect(
                                child: Transform(
                                  alignment: Alignment.center,
                                  transform: Matrix4.diagonal3Values(
                                    mirror ? -1 : 1,
                                    1,
                                    1,
                                  ),
                                  child: CameraPreview(cam),
                                ),
                              )
                            : const Center(
                                child: CircularProgressIndicator(),
                              ),
                  ),
                  Container(
                    width: double.infinity,
                    color: surfaces.elevated.withValues(alpha: 0.96),
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                    child: _panel(),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _message(String text) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(text, textAlign: TextAlign.center),
      ),
    );
  }

  Widget _panel() {
    final title = widget.title.trim().isEmpty ? 'This song' : widget.title.trim();
    final artist = widget.artistName.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          artist.isEmpty ? title : '$title — $artist',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          _phase == _CapturePhase.recording
              ? 'Recording ${_recordedSeconds}s / ${SocialShare.clipMs ~/ 1000}s'
              : 'Mic stays off. The song that is playing is saved into the clip.',
          style: TextStyle(color: context.networxSurfaces.textSecondary, fontSize: 12),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
        ],
        const SizedBox(height: 12),
        if (_phase == _CapturePhase.preparing || _phase == _CapturePhase.mixing)
          const Center(child: CircularProgressIndicator())
        else if (_phase == _CapturePhase.review)
          _reviewActions()
        else
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _phase == _CapturePhase.ready ? _takePhoto : null,
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: const Text('Photo'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _phase == _CapturePhase.recording
                      ? _stopVideo
                      : _phase == _CapturePhase.ready
                          ? _startVideo
                          : null,
                  icon: Icon(
                    _phase == _CapturePhase.recording
                        ? Icons.stop
                        : Icons.fiber_manual_record,
                  ),
                  label: Text(_phase == _CapturePhase.recording ? 'Stop' : 'Video'),
                  style: FilledButton.styleFrom(
                    backgroundColor: DimensionTokens.neonCyan,
                    foregroundColor: Colors.black,
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }

  Widget _reviewActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton(
          onPressed: _posting ? null : _post,
          child: Text(_posting ? 'Posting…' : 'Post to feed'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _posting ? null : _retake,
          child: const Text('Retake'),
        ),
        const SizedBox(height: 12),
        SocialShareBar(
          caption: _caption,
          resolveFile: () async {
            final file = _clip;
            if (file == null) throw Exception('Record a clip first');
            return file;
          },
        ),
      ],
    );
  }
}
