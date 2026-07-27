import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

/// Receive-only WHEP (WebRTC-HTTP Egress Protocol) audio player for the DJ
/// booth talk-over. Cloudflare Stream only supports WebRTC playback for
/// streams that were published via WHIP — the HLS manifest of a WHIP input
/// always returns 204 — so listeners must connect over WHEP.
///
/// Remote WebRTC audio is routed straight to the device output by
/// flutter_webrtc; no renderer is needed for audio-only playback. Mixing with
/// the just_audio music player happens in the OS audio mixer.
class WhepPlayer {
  RTCPeerConnection? _pc;
  MediaStream? _remoteStream;
  String? _url;
  String? _resourceUrl;
  bool _muted = false;
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
  String? get url => _url;
  MediaStream? get remoteStream => _remoteStream;

  /// Connect to [whepUrl] and start playing the remote audio. Safe to call
  /// repeatedly; reconnects only when the URL changes.
  Future<void> start(String whepUrl) async {
    if (_url == whepUrl && _pc != null) return;
    await stop();
    _url = whepUrl;
    _consecutiveFailures = 0;
    await _connect();
  }

  Future<void> _connect() async {
    final whepUrl = _url;
    if (whepUrl == null) return;
    await _closePeerOnly();

    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.cloudflare.com:3478'},
      ],
      'sdpSemantics': 'unified-plan',
    });
    _pc = pc;

    pc.onTrack = (event) {
      if (_url != whepUrl) return;
      final stream = event.streams.isNotEmpty ? event.streams.first : null;
      if (stream != null && stream != _remoteStream) {
        _remoteStream = stream;
        onRemoteStream?.call(stream);
      }
      if (event.track.kind == 'audio') {
        event.track.enabled = !_muted;
      }
      _consecutiveFailures = 0;
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
    } catch (_) {
      _scheduleRetry();
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
      if (_url != null) unawaited(_connect());
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

  Future<void> _closePeerOnly() async {
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
      await _pc?.close();
    } catch (_) {}
    _pc = null;
    _remoteStream = null;
  }

  Future<void> stop() async {
    _url = null;
    await _closePeerOnly();
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
