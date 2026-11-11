import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/audio/headphone_route.dart';
import '../../core/audio/station_cue_player.dart';
import '../../core/radio/radio_sync.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/livestream_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/whip_broadcaster.dart';
import '../../core/ui/media_permission.dart';
import 'widgets/live_chat_panel.dart';

class GoLiveScreen extends StatefulWidget {
  /// Optional host intent ('dj' or 'musician') so the session surfaces on the
  /// matching Live tab regardless of the broadcaster's account role. Null for a
  /// regular artist stream.
  final String? hostType;

  const GoLiveScreen({super.key, this.hostType});

  @override
  State<GoLiveScreen> createState() => _GoLiveScreenState();
}

class _GoLiveScreenState extends State<GoLiveScreen> {
  final LivestreamService _live = LivestreamService();
  final WhipBroadcaster _broadcaster = WhipBroadcaster();
  final RTCVideoRenderer _renderer = RTCVideoRenderer();
  final TextEditingController _title =
      TextEditingController(text: 'Live from NETWORX');
  final TextEditingController _description = TextEditingController();
  final TextEditingController _category = TextEditingController();

  bool _loading = false;
  bool _live2 = false;
  bool _micOn = true;
  bool _camOn = true;
  bool _mirror = true;
  String? _statusText;
  Map<String, dynamic>? _ingest;
  String? _sessionId;
  // 'device' = broadcast from this phone (WHIP); 'obs' = external encoder via
  // RTMP. Only one publishes to Cloudflare at a time — switching to 'obs'
  // releases the phone camera/mic so the encoder can take over.
  String _streamSource = 'device';
  bool _didSoftPauseRadio = false;
  bool _keepRadioPaused = false;
  bool _headphones = false;
  bool _headphonesKnown = false;
  StreamSubscription<Set<AudioDevice>>? _headphoneSub;
  Timer? _cueTimer;
  final StationCuePlayer _cue = StationCuePlayer();
  final RadioService _radio = RadioService();

  @override
  void initState() {
    super.initState();
    // Mute radio immediately — opening camera/mic must not un-duck a quiet
    // radio stream into a sudden full-volume blast.
    unawaited(_softPauseRadio());
    if (widget.hostType == 'dj') {
      unawaited(_watchHeadphones());
    }
    _renderer.initialize().then((_) {
      if (!mounted) return;
      // Re-bind if WHIP already attached a stream before init finished.
      final pending = _broadcaster.localStream;
      if (pending != null) {
        _renderer.srcObject = pending;
        setState(() {});
      }
    }).catchError((_) {
      // Preview may still work once srcObject is assigned later.
    });
  }

  @override
  void dispose() {
    // Best-effort teardown if the host swipes away / the route is removed
    // without tapping End live — otherwise the session stays "live" server-side.
    _cueTimer?.cancel();
    _cue.silence();
    unawaited(_headphoneSub?.cancel());
    unawaited(_cue.dispose());
    if (_live2 || _sessionId != null) {
      unawaited(_teardownBroadcast(callApi: true));
    } else {
      unawaited(_broadcaster.dispose());
    }
    unawaited(_softResumeRadioIfNeeded());
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _renderer.dispose();
    super.dispose();
  }

  /// Stop WHIP/camera and mark the session ended on the backend.
  Future<void> _teardownBroadcast({required bool callApi}) async {
    try {
      await _broadcaster.dispose();
    } catch (_) {}
    try {
      _renderer.srcObject = null;
    } catch (_) {}
    if (callApi) {
      try {
        await _live.stop();
      } catch (_) {}
    }
  }

  Future<void> _softPauseRadio() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
        _didSoftPauseRadio = true;
      }
      // Fully release the audio unit — soft-pause keeps just_audio rendering
      // at volume 0, which can silence WebRTC mic capture on iOS.
      await handler.hardPauseMusicForCapture();
    } catch (_) {}
  }

  bool get _djNeedsHeadphones => widget.hostType == 'dj';

  String _djStationId() {
    try {
      final tag = AudioPlayerService().player.sequenceState.currentSource?.tag;
      if (tag is MediaItem) {
        final id = tag.extras?['radioId']?.toString().trim();
        if (id != null && id.isNotEmpty) return id;
      }
    } catch (_) {}
    return RadioService.defaultRadioId;
  }

  Future<void> _watchHeadphones() async {
    try {
      final session = await AudioSession.instance;
      final initial = await session.getDevices();
      _applyHeadphones(headphonesConnected(initial), known: true);
      _headphoneSub = session.devicesStream.listen((devices) {
        _applyHeadphones(headphonesConnected(devices), known: true);
      });
    } catch (_) {
      if (mounted) setState(() => _headphonesKnown = true);
    }
  }

  void _applyHeadphones(bool on, {required bool known}) {
    if (!on) _cue.silence();
    final was = _headphones;
    _headphones = on;
    _headphonesKnown = known;
    if (!on) {
      unawaited(_softPauseRadio());
      if (was && _live2 && _streamSource == 'device') {
        unawaited(_abortBecauseSpeakers());
      }
    } else if (!_live2) {
      _keepRadioPaused = false;
      unawaited(_softResumeRadioIfNeeded());
    } else if (_streamSource == 'device') {
      unawaited(_syncGoLiveCue());
    }
    if (mounted) setState(() {});
  }

  Future<void> _syncGoLiveCue() async {
    if (!_djNeedsHeadphones || !_live2 || !_headphones) {
      _cue.silence();
      return;
    }
    final result = await _radio.getCurrentTrack(radioId: _djStationId());
    final track = result.track;
    if (!mounted || !_headphones || !_live2) return;
    if (track == null || track.audioUrl.isEmpty || track.transportPaused) {
      await _cue.sync(url: '', position: Duration.zero, playing: false);
      return;
    }
    await _cue.sync(
      url: track.audioUrl,
      position: Duration(seconds: liveTargetSeconds(track)),
      playing: true,
    );
  }

  void _startCueLoop() {
    _cueTimer?.cancel();
    if (!_djNeedsHeadphones) return;
    unawaited(_syncGoLiveCue());
    _cueTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      unawaited(_syncGoLiveCue());
    });
  }

  Future<void> _abortBecauseSpeakers() async {
    _keepRadioPaused = true;
    _cue.silence();
    _cueTimer?.cancel();
    try {
      await _cue.stop();
    } catch (_) {}
    try {
      await _teardownBroadcast(callApi: true);
    } catch (_) {}
    _didSoftPauseRadio = false;
    if (!mounted) return;
    setState(() {
      _live2 = false;
      _ingest = null;
      _sessionId = null;
      _statusText = null;
      _loading = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Headphones disconnected. The live mic was turned off so the station does not play through the speakers.',
        ),
      ),
    );
  }

  Future<void> _softResumeRadioIfNeeded() async {
    if (_keepRadioPaused) return;
    if (_djNeedsHeadphones && !_headphones) return;
    if (!_didSoftPauseRadio) return;
    _didSoftPauseRadio = false;
    try {
      await AudioPlayerService.restoreMusicSession();
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  Future<void> _start() async {
    setState(() {
      _loading = true;
      _statusText = 'Starting session…';
    });
    var sessionCreated = false;
    try {
      if (_djNeedsHeadphones && !_headphones) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Plug in headphones or a headset before going live.'),
          ),
        );
        return;
      }
      await _softPauseRadio();
      if (_djNeedsHeadphones) {
        await AudioPlayerService.prepareForHeadphoneBroadcast();
      } else {
        await AudioPlayerService.prepareForBroadcast();
      }
      final data = await _live.start(
        title: _title.text.trim().isEmpty ? null : _title.text.trim(),
        description:
            _description.text.trim().isEmpty ? null : _description.text.trim(),
        category: _category.text.trim().isEmpty ? null : _category.text.trim(),
        hostType: widget.hostType,
      );
      _ingest = data?['ingest'] is Map<String, dynamic>
          ? data!['ingest'] as Map<String, dynamic>
          : null;
      final session = data?['session'] is Map<String, dynamic>
          ? data!['session'] as Map<String, dynamic>
          : null;
      _sessionId = session?['id']?.toString();
      sessionCreated = _sessionId != null;
      final whipUrl = _ingest?['webRtcUrl'] as String?;

      if (whipUrl == null || whipUrl.isEmpty) {
        // Backend didn't return a WebRTC publish URL — fall back to showing
        // the RTMP details so the user can broadcast with an encoder.
        setState(() {
          _live2 = true;
          _streamSource = 'obs';
          _statusText = 'Live session created. Use the RTMP details below.';
        });
        _startCueLoop();
        return;
      }

      // Live DJ matches web: audio-first (camera off). Live Performances keep
      // the camera on so the stage is visible.
      final wantVideo = widget.hostType != 'dj';
      if (!mounted || !await confirmMediaAccess(context, camera: wantVideo)) {
        if (sessionCreated) {
          try {
            await _live.stop();
          } catch (_) {}
        }
        if (mounted) {
          setState(() {
            _statusText = null;
            _loading = false;
          });
        }
        return;
      }
      setState(() => _statusText =
          wantVideo ? 'Requesting camera & mic…' : 'Requesting microphone…');
      // Show local preview immediately so the host isn't stuck on a black
      // "Connecting…" screen while WHIP negotiates.
      final local = await _broadcaster.acquireLocalMedia(video: wantVideo);
      _renderer.srcObject = local;
      if (mounted) {
        setState(() {
          _live2 = true;
          _streamSource = 'device';
          _micOn = true;
          _camOn = wantVideo;
          _statusText = 'Connecting to stream…';
        });
      }

      final stream = await _broadcaster.start(whipUrl, video: wantVideo);
      _renderer.srcObject = stream;
      try {
        await _live.markPublishing(sessionId: _sessionId, ingestMode: 'whip');
      } catch (_) {
        // Non-fatal — Cloudflare webhook may still promote the session.
      }
      if (!mounted) return;
      setState(() {
        _statusText = null;
      });
      _startCueLoop();
    } catch (e) {
      // Don't leave a ghost "starting" session that blacks out watchers and
      // blocks the next Go Live attempt.
      if (sessionCreated) {
        try {
          await _live.stop();
        } catch (_) {}
        _sessionId = null;
        _ingest = null;
      }
      try {
        await _broadcaster.dispose();
      } catch (_) {}
      try {
        _renderer.srcObject = null;
      } catch (_) {}
      if (!mounted) return;
      final text = e.toString().toLowerCase();
      if (text.contains('permission') ||
          text.contains('notallowed') ||
          text.contains('denied')) {
        await offerOpenSettings(context);
      } else {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Could not start the live session. Try again.')));
      }
      setState(() {
        _live2 = false;
        _statusText = null;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Switch the publishing source while live. Only one source may publish to
  /// the Cloudflare input at a time, so switching to OBS releases the phone
  /// camera/mic, and switching back re-acquires them and renegotiates WHIP.
  Future<void> _setSource(String source) async {
    if (source == _streamSource || _loading) return;
    final whipUrl = _ingest?['webRtcUrl'] as String?;
    if (source == 'device' && (whipUrl == null || whipUrl.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('In-app broadcasting is unavailable for this session.'),
        ),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      if (source == 'obs') {
        await _broadcaster.dispose();
        _renderer.srcObject = null;
        if (!mounted) return;
        setState(() {
          _streamSource = 'obs';
          _camOn = false;
          _statusText = null;
        });
      } else {
        final wantVideo = widget.hostType != 'dj';
        setState(() => _statusText =
            wantVideo ? 'Requesting camera & mic…' : 'Requesting microphone…');
        if (_djNeedsHeadphones && !_headphones) {
          throw Exception('Plug in headphones or a headset before going live.');
        }
        if (_djNeedsHeadphones) {
          await AudioPlayerService.prepareForHeadphoneBroadcast();
        } else {
          await AudioPlayerService.prepareForBroadcast();
        }
        final local = await _broadcaster.acquireLocalMedia(video: wantVideo);
        _renderer.srcObject = local;
        if (mounted) {
          setState(() {
            _streamSource = 'device';
            _micOn = true;
            _camOn = wantVideo;
            _statusText = 'Connecting to stream…';
          });
        }
        final stream = await _broadcaster.start(whipUrl!, video: wantVideo);
        _renderer.srcObject = stream;
        try {
          await _live.markPublishing(sessionId: _sessionId, ingestMode: 'whip');
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _statusText = null;
        });
        _startCueLoop();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Switch failed: $e')));
      setState(() => _statusText = null);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<bool> _confirmEndLive() async {
    if (!_live2 && _sessionId == null) return true;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End live stream?'),
        content: const Text(
          'This stops broadcasting and ends the session for viewers.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep streaming'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('End live'),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  /// Ends the stream. Returns true when local+API teardown finished.
  Future<bool> _stop({bool confirm = true}) async {
    if (confirm) {
      final ok = await _confirmEndLive();
      if (!ok) return false;
    }
    if (!mounted) return false;
    setState(() => _loading = true);
    try {
      _cueTimer?.cancel();
      _cue.silence();
      await _cue.stop();
      await _teardownBroadcast(callApi: true);
      if (!mounted) return true;
      setState(() {
        _live2 = false;
        _ingest = null;
        _sessionId = null;
        _streamSource = 'device';
        _statusText = null;
      });
      await _softResumeRadioIfNeeded();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Live stream ended.')),
        );
      }
      return true;
    } catch (e) {
      // Still clear local live state so the host isn't stuck "broadcasting".
      if (mounted) {
        setState(() {
          _live2 = false;
          _ingest = null;
          _sessionId = null;
          _statusText = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ended locally. Server stop failed: $e')),
        );
      }
      return true;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleBack() async {
    if (!_live2 && _sessionId == null) {
      if (mounted) Navigator.of(context).maybePop();
      return;
    }
    final ended = await _stop(confirm: true);
    if (ended && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_live2 && _sessionId == null,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _handleBack();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.hostType == 'dj'
                ? 'Go Live as DJ'
                : widget.hostType == 'musician'
                    ? 'Go Live as Musician'
                    : 'Go Live',
          ),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _loading ? null : _handleBack,
          ),
          actions: [
            if (_live2 || _sessionId != null)
              TextButton(
                onPressed: _loading
                    ? null
                    : () async {
                        final ended = await _stop(confirm: true);
                        if (ended && mounted) Navigator.of(context).pop();
                      },
                child: Text(
                  _loading ? 'Ending…' : 'End live',
                  style: const TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
          ],
        ),
        body: _live2 ? _buildLiveView() : _buildSetupView(),
      ),
    );
  }

  Widget _buildSetupView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Stream info',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: Theme.of(context).colorScheme.primary,
              ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _title,
          decoration: const InputDecoration(
            labelText: 'Title',
            hintText: 'e.g. Studio session',
            border: OutlineInputBorder(),
          ),
          maxLength: 140,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _description,
          decoration: const InputDecoration(
            labelText: 'Description',
            hintText: "What's this stream about?",
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
          maxLength: 1000,
          maxLines: 3,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _category,
          decoration: const InputDecoration(
            labelText: 'Category',
            hintText: 'e.g. Music, Talk',
            border: OutlineInputBorder(),
          ),
          maxLength: 64,
        ),
        const SizedBox(height: 16),
        if (_djNeedsHeadphones) ...[
          Text(
            !_headphonesKnown
                ? 'Checking for headphones…'
                : _headphones
                    ? 'Headphones connected. You will hear the station in your headset while you are live.'
                    : 'Plug in headphones or a headset to go live. The station plays in your ears so it does not feed back into the mic.',
            style: TextStyle(
              color: _headphones
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.error,
            ),
          ),
          const SizedBox(height: 12),
        ],
        FilledButton.icon(
          onPressed: _loading || (_djNeedsHeadphones && !_headphones) ? null : _start,
          icon: Icon(_djNeedsHeadphones ? Icons.headphones : Icons.videocam),
          label: Text(_loading ? (_statusText ?? 'Starting…') : 'Start live'),
        ),
        const SizedBox(height: 12),
        const Text(
          'Broadcasts straight from your phone camera and mic. You can switch '
          'cameras and mute once you go live.',
        ),
      ],
    );
  }

  Widget _buildLiveView() {
    final hasVideo = _renderer.srcObject != null;
    return Column(
      children: [
        Expanded(
          flex: 2,
          child: Container(
            color: Colors.black,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (hasVideo && _camOn)
                  RTCVideoView(
                    _renderer,
                    objectFit:
                        RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    mirror: _mirror,
                  )
                else
                  Center(
                    child: Text(
                      _streamSource == 'obs'
                          ? 'Streaming via OBS / encoder'
                          : (!_camOn
                              ? 'Camera off'
                              : (_statusText ?? 'Connecting…')),
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ),
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'LIVE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                // Always-visible end control over the preview (chat can bury
                // the bottom button on small phones).
                Positioned(
                  top: 8,
                  right: 8,
                  child: FilledButton.tonalIcon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.red.shade700,
                      foregroundColor: Colors.white,
                    ),
                    onPressed: _loading
                        ? null
                        : () async {
                            final ended = await _stop(confirm: true);
                            if (ended && mounted) {
                              Navigator.of(context).pop();
                            }
                          },
                    icon: const Icon(Icons.stop, size: 18),
                    label: Text(_loading ? 'Ending…' : 'End'),
                  ),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          flex: 3,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              children: [
                _buildSourceToggle(),
                const SizedBox(height: 12),
                if (_streamSource == 'obs') ...[
                  _buildRtmpDetails(),
                  const SizedBox(height: 12),
                ] else
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _controlButton(
                        icon: _micOn ? Icons.mic : Icons.mic_off,
                        label: _micOn ? 'Mic on' : 'Mic off',
                        active: _micOn,
                        onTap: () =>
                            setState(() => _micOn = _broadcaster.toggleMic()),
                      ),
                      _controlButton(
                        icon: _camOn ? Icons.videocam : Icons.videocam_off,
                        label: _camOn ? 'Camera' : 'Cam off',
                        active: _camOn,
                        onTap: () async {
                          // Live DJ starts audio-only — toggle must acquire a
                          // camera track and replaceTrack into the WHIP sender
                          // (sync toggleCamera() is a no-op with no video track).
                          try {
                            final on = await _broadcaster.toggleCameraAsync();
                            _renderer.srcObject = _broadcaster.localStream;
                            if (mounted) {
                              setState(() {
                                _camOn = on;
                                _mirror = _broadcaster.isFrontCamera;
                              });
                            }
                          } catch (_) {
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Could not switch the camera. Check permissions.',
                                ),
                              ),
                            );
                          }
                        },
                      ),
                      _controlButton(
                        icon: Icons.cameraswitch,
                        label: 'Flip',
                        active: _camOn,
                        onTap: () async {
                          if (!_camOn) return;
                          await _broadcaster.switchCamera();
                          _renderer.srcObject = _broadcaster.localStream;
                          if (mounted) {
                            setState(
                              () => _mirror = _broadcaster.isFrontCamera,
                            );
                          }
                        },
                      ),
                    ],
                  ),
                const SizedBox(height: 12),
                if (_sessionId != null)
                  Expanded(
                    child: LiveChatPanel(
                      sessionId: _sessionId!,
                      canModerate: true,
                    ),
                  )
                else
                  const Expanded(child: SizedBox.shrink()),
                const SizedBox(height: 12),
                SafeArea(
                  top: false,
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.red,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed: _loading
                          ? null
                          : () async {
                              final ended = await _stop(confirm: true);
                              if (ended && mounted) {
                                Navigator.of(context).pop();
                              }
                            },
                      icon: const Icon(Icons.stop),
                      label: Text(_loading ? 'Ending…' : 'End live'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Lets the host pick where the broadcast comes from: this phone (WHIP) or an
  /// external encoder such as OBS (RTMP). Hidden when in-app broadcasting isn't
  /// available for the session, since OBS is then the only option.
  Widget _buildSourceToggle() {
    final whipUrl = _ingest?['webRtcUrl'] as String?;
    final canUseDevice = whipUrl != null && whipUrl.isNotEmpty;
    if (!canUseDevice) return const SizedBox.shrink();
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(
          value: 'device',
          label: Text('This phone'),
          icon: Icon(Icons.smartphone),
        ),
        ButtonSegment(
          value: 'obs',
          label: Text('OBS / encoder'),
          icon: Icon(Icons.dvr),
        ),
      ],
      selected: {_streamSource},
      onSelectionChanged: _loading
          ? null
          : (selection) => _setSource(selection.first),
    );
  }

  Widget _buildRtmpDetails() {
    final rtmpUrl = _ingest?['rtmpUrl']?.toString() ?? '';
    final streamKey = _ingest?['streamKey']?.toString() ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Point your encoder at these and start streaming:',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        _copyRow('RTMP URL', rtmpUrl),
        const SizedBox(height: 4),
        _copyRow('Stream key', streamKey),
      ],
    );
  }

  Widget _copyRow(String label, String value) {
    return Row(
      children: [
        Expanded(
          child: Text(
            '$label: $value',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.copy, size: 18),
          onPressed: value.isEmpty
              ? null
              : () {
                  Clipboard.setData(ClipboardData(text: value));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$label copied')),
                  );
                },
        ),
      ],
    );
  }

  Widget _controlButton({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton.filledTonal(
          onPressed: onTap,
          icon: Icon(icon),
          color: active ? null : Colors.red,
        ),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
