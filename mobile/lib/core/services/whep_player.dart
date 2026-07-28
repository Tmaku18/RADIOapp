import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

/// Receive-only WHEP (WebRTC-HTTP Egress Protocol) player for:
/// - DJ booth talk-over (audio-only; uses a headless [RTCVideoRenderer] so
///   iOS actually routes remote audio), and
/// - Livestream viewing (audio + video; caller binds its own renderer —
///   never attach the headless sink or it steals the video frames).
class WhepPlayer {
  RTCPeerConnection? _pc;
  MediaStream? _remoteStream;
  RTCVideoRenderer? _audioSink;
  String? _url;
  String? _resourceUrl;
  bool _muted = false;
  bool _hasRemoteAudio = false;
  bool _hasRemoteVideo = false;
  bool _bindHeadlessAudioSink = true;
  Timer? _retryTimer;
  int _consecutiveFailures = 0;

  static const int _maxConsecutiveFailures = 5;

  /// Invoked when the connection keeps failing (e.g. the DJ vanished without
  /// a mic_off) so the owner can un-duck the music instead of leaving it
  /// quiet forever.
  void Function()? onPermanentFailure;

  /// Invoked when the remote media stream arrives or gains a new track —
  /// bind it to an [RTCVideoRenderer] for video playback (livestream viewing).
  /// Called again when a video track arrives after audio so the UI can rebind.
  void Function(MediaStream stream)? onRemoteStream;

  bool get isActive => _url != null;
  bool get hasRemoteAudio => _hasRemoteAudio;
  bool get hasRemoteVideo => _hasRemoteVideo;
  String? get url => _url;
  MediaStream? get remoteStream => _remoteStream;

  /// Connect to [whepUrl] and start playing remote media.
  ///
  /// Set [bindHeadlessAudioSink] to false for livestream viewing where the
  /// caller owns a visible [RTCVideoRenderer]. Leaving it true (default)
  /// attaches a hidden renderer so booth talk-over audio plays on iOS — but
  /// that same sink steals video frames from any second renderer.
  Future<void> start(
    String whepUrl, {
    bool bindHeadlessAudioSink = true,
    bool waitForAudio = true,
  }) async {
    if (_url == whepUrl &&
        _pc != null &&
        _hasRemoteAudio &&
        _bindHeadlessAudioSink == bindHeadlessAudioSink) {
      return;
    }
    await stop();
    _url = whepUrl;
    _consecutiveFailures = 0;
    _hasRemoteAudio = false;
    _hasRemoteVideo = false;
    _bindHeadlessAudioSink = bindHeadlessAudioSink;
    if (bindHeadlessAudioSink) {
      await _ensureAudioSink();
    }
    await _connect(waitForAudio: waitForAudio);
  }

  Future<void> _ensureAudioSink() async {
    if (_audioSink != null) return;
    final renderer = RTCVideoRenderer();
    await renderer.initialize();
    _audioSink = renderer;
  }

  void _emitRemoteStream(MediaStream stream) {
    _remoteStream = stream;
    if (_bindHeadlessAudioSink) {
      _audioSink?.srcObject = stream;
    }
    onRemoteStream?.call(stream);
  }

  Future<void> _connect({bool waitForAudio = false}) async {
    final whepUrl = _url;
    if (whepUrl == null) return;
    await _closePeerOnly(keepUrl: true);

    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.cloudflare.com:3478'},
      ],
      'sdpSemantics': 'unified-plan',
    });
    _pc = pc;

    final audioReady = Completer<void>();

    pc.onTrack = (event) {
      if (_url != whepUrl) return;

      MediaStream? stream =
          event.streams.isNotEmpty ? event.streams.first : _remoteStream;

      // Some stacks deliver a bare track with no stream container — build one.
      if (stream == null) {
        unawaited(() async {
          try {
            final synth = await createLocalMediaStream('whep-remote');
            await synth.addTrack(event.track);
            if (_url != whepUrl) return;
            event.track.enabled =
                event.track.kind == 'audio' ? !_muted : true;
            if (event.track.kind == 'audio') {
              _hasRemoteAudio = true;
              _consecutiveFailures = 0;
              if (!audioReady.isCompleted) audioReady.complete();
              try {
                Helper.setSpeakerphoneOn(true);
              } catch (_) {}
            } else if (event.track.kind == 'video') {
              _hasRemoteVideo = true;
            }
            _emitRemoteStream(synth);
          } catch (e) {
            debugPrint('WhepPlayer: synth stream failed: $e');
          }
        }());
        return;
      }

      if (event.track.kind == 'audio') {
        event.track.enabled = !_muted;
        _hasRemoteAudio = true;
        _consecutiveFailures = 0;
        if (!audioReady.isCompleted) audioReady.complete();
        try {
          Helper.setSpeakerphoneOn(true);
        } catch (_) {}
      } else if (event.track.kind == 'video') {
        event.track.enabled = true;
        _hasRemoteVideo = true;
      }

      // Always re-emit on video (and on first stream) so the visible renderer
      // rebinds after late video tracks — otherwise audio-first delivery leaves
      // a black frame forever.
      final isNewStream = stream != _remoteStream;
      final isVideo = event.track.kind == 'video';
      if (isNewStream || isVideo || _remoteStream == null) {
        _emitRemoteStream(stream);
      }
    };

    pc.onConnectionState = (state) {
      if (_url != whepUrl) return;
      if (state ==
              RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          state ==
              RTCPeerConnectionState.RTCPeerConnectionStateDisconnected) {
        _scheduleRetry();
      }
    };

    // Video first so the offer prefers a video m-line (matches web watch page).
    await pc.addTransceiver(
      kind: RTCRtpMediaType.RTCRtpMediaTypeVideo,
      init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
    );
    await pc.addTransceiver(
      kind: RTCRtpMediaType.RTCRtpMediaTypeAudio,
      init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
    );

    try {
      final offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      await _waitForIceGathering(pc);

      final local = await pc.getLocalDescription();
      final sdp = local?.sdp ?? offer.sdp ?? '';

      final res = await http
          .post(
            Uri.parse(whepUrl),
            headers: {'Content-Type': 'application/sdp'},
            body: sdp,
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode >= 300) {
        throw Exception('WHEP negotiation failed (${res.statusCode})');
      }
      final location = res.headers['location'];
      if (location != null && location.isNotEmpty) {
        _resourceUrl = Uri.parse(whepUrl).resolve(location).toString();
      }
      if (_url != whepUrl) return;
      await pc.setRemoteDescription(RTCSessionDescription(res.body, 'answer'));

      if (waitForAudio) {
        try {
          await audioReady.future.timeout(const Duration(seconds: 8));
        } on TimeoutException {
          debugPrint('WhepPlayer: no remote audio yet for $whepUrl');
        }
      }
    } catch (e) {
      debugPrint('WhepPlayer: connect error: $e');
      _scheduleRetry();
      rethrow;
    }
  }

  void _scheduleRetry() {
    if (_url == null) return;
    _consecutiveFailures++;
    if (_consecutiveFailures > _maxConsecutiveFailures) {
      final callback = onPermanentFailure;
      unawaited(stop());
      callback?.call();
      return;
    }
    _retryTimer?.cancel();
    _retryTimer = Timer(const Duration(seconds: 2), () {
      if (_url != null) unawaited(_connect(waitForAudio: false));
    });
  }

  /// Mute/unmute the remote DJ voice without tearing down the connection
  /// (used when the listener soft-pauses the radio).
  void setMuted(bool muted) {
    _muted = muted;
    final stream = _remoteStream;
    if (stream != null) {
      for (final track in stream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  Future<void> _closePeerOnly({bool keepUrl = false}) async {
    _retryTimer?.cancel();
    _retryTimer = null;
    final resourceUrl = _resourceUrl;
    _resourceUrl = null;
    if (resourceUrl != null) {
      unawaited(
        http.delete(Uri.parse(resourceUrl)).catchError(
              (Object _) => http.Response('', 200),
            ),
      );
    }
    try {
      _audioSink?.srcObject = null;
    } catch (_) {}
    try {
      await _pc?.close();
    } catch (_) {}
    _pc = null;
    _remoteStream = null;
    _hasRemoteAudio = false;
    _hasRemoteVideo = false;
    if (!keepUrl) {
      // no-op; stop() clears url
    }
  }

  Future<void> stop() async {
    _url = null;
    await _closePeerOnly();
  }

  Future<void> dispose() async {
    await stop();
    try {
      await _audioSink?.dispose();
    } catch (_) {}
    _audioSink = null;
  }

  Future<void> _waitForIceGathering(RTCPeerConnection pc) async {
    if (pc.iceGatheringState ==
        RTCIceGatheringState.RTCIceGatheringStateComplete) {
      return;
    }
    final completer = Completer<void>();
    final timer = Timer(const Duration(milliseconds: 2500), () {
      if (!completer.isCompleted) completer.complete();
    });
    pc.onIceGatheringState = (state) {
      if (state == RTCIceGatheringState.RTCIceGatheringStateComplete &&
          !completer.isCompleted) {
        completer.complete();
      }
    };
    await completer.future;
    timer.cancel();
  }
}
