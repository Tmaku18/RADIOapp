import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

/// Receive-only WHEP (WebRTC-HTTP Egress Protocol) audio player for the DJ
/// booth talk-over. Cloudflare Stream only supports WebRTC playback for
/// streams that were published via WHIP — the HLS manifest of a WHIP input
/// always returns 204 — so listeners must connect over WHEP.
///
/// Remote WebRTC audio is routed by flutter_webrtc. On some platforms binding
/// the remote stream to a headless [RTCVideoRenderer] is required for the
/// audio unit to actually output sound.
class WhepPlayer {
  RTCPeerConnection? _pc;
  MediaStream? _remoteStream;
  RTCVideoRenderer? _audioSink;
  String? _url;
  String? _resourceUrl;
  bool _muted = false;
  bool _hasRemoteAudio = false;
  Timer? _retryTimer;
  int _consecutiveFailures = 0;

  static const int _maxConsecutiveFailures = 5;

  /// Invoked when the connection keeps failing (e.g. the DJ vanished without
  /// a mic_off) so the owner can un-duck the music instead of leaving it
  /// quiet forever.
  void Function()? onPermanentFailure;

  /// Invoked when the remote media stream arrives — bind it to an
  /// [RTCVideoRenderer] for video playback (livestream viewing).
  void Function(MediaStream stream)? onRemoteStream;

  bool get isActive => _url != null;
  bool get hasRemoteAudio => _hasRemoteAudio;
  String? get url => _url;
  MediaStream? get remoteStream => _remoteStream;

  /// Connect to [whepUrl] and start playing the remote audio. Safe to call
  /// repeatedly; reconnects only when the URL changes.
  ///
  /// Completes after an audio track arrives (or after a timeout so callers can
  /// decide whether to duck music). Throws if negotiation fails hard.
  Future<void> start(String whepUrl) async {
    if (_url == whepUrl && _pc != null && _hasRemoteAudio) return;
    await stop();
    _url = whepUrl;
    _consecutiveFailures = 0;
    _hasRemoteAudio = false;
    await _ensureAudioSink();
    await _connect(waitForAudio: true);
  }

  Future<void> _ensureAudioSink() async {
    if (_audioSink != null) return;
    final renderer = RTCVideoRenderer();
    await renderer.initialize();
    _audioSink = renderer;
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
      if (event.streams.isNotEmpty) {
        final stream = event.streams.first;
        if (stream != _remoteStream) {
          _remoteStream = stream;
          // Headless renderer keeps the WebRTC audio unit routed to speakers
          // on iOS/Android even for audio-only talk-overs.
          _audioSink?.srcObject = stream;
          onRemoteStream?.call(stream);
        }
      }

      if (event.track.kind == 'audio') {
        event.track.enabled = !_muted;
        _hasRemoteAudio = true;
        _consecutiveFailures = 0;
        if (!audioReady.isCompleted) audioReady.complete();
        try {
          Helper.setSpeakerphoneOn(true);
        } catch (_) {}
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

    await pc.addTransceiver(
      kind: RTCRtpMediaType.RTCRtpMediaTypeAudio,
      init: RTCRtpTransceiverInit(direction: TransceiverDirection.RecvOnly),
    );
    await pc.addTransceiver(
      kind: RTCRtpMediaType.RTCRtpMediaTypeVideo,
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
        // Wait for remote audio, but don't hang forever — Cloudflare may still
        // be warming the WHIP ingest. Callers can retry via mic_on / poll.
        try {
          await audioReady.future.timeout(const Duration(seconds: 8));
        } on TimeoutException {
          debugPrint('WhepPlayer: no remote audio yet for $whepUrl');
          // Still mark active; retry loop may recover. Don't throw so duck
          // logic in the handler can decide based on hasRemoteAudio.
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
      // Best-effort WHEP session delete so Cloudflare frees the connection.
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
