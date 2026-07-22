import 'dart:async';

import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

/// Publishes the device camera + microphone to a Cloudflare Stream live input
/// using WHIP (WebRTC-HTTP Ingestion Protocol). The Cloudflare WHIP publish URL
/// is returned by the backend in the `ingest.webRtcUrl` field of start().
class WhipBroadcaster {
  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  String _facingMode = 'user';

  MediaStream? get localStream => _localStream;

  /// True when the front (selfie) camera is active — used to mirror the local
  /// self-preview without affecting the outgoing stream.
  bool get isFrontCamera => _facingMode == 'user';
  bool get isPublishing => _pc != null;

  /// Acquire camera/mic only so the host can see a local preview before WHIP
  /// negotiation finishes (or if publish fails).
  Future<MediaStream> acquireLocalMedia() async {
    if (_localStream != null) return _localStream!;
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      'video': {
        'facingMode': _facingMode,
        'mandatory': {'minFrameRate': '24'},
        'optional': [],
      },
    });
    return _localStream!;
  }

  /// Acquire camera/mic (if needed), then negotiate a WHIP session.
  /// Returns the local [MediaStream] for self-preview.
  Future<MediaStream> start(String whipUrl) async {
    final stream = await acquireLocalMedia();
    // Drop any half-open peer from a previous attempt before renegotiating.
    await _closePeerOnly();

    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.cloudflare.com:3478'},
      ],
      'sdpSemantics': 'unified-plan',
    });
    _pc = pc;

    for (final track in stream.getTracks()) {
      await pc.addTrack(track, stream);
    }

    final offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    await _waitForIceGathering(pc);

    final local = await pc.getLocalDescription();
    final sdp = local?.sdp ?? offer.sdp ?? '';

    late final http.Response res;
    try {
      res = await http
          .post(
            Uri.parse(whipUrl),
            headers: {'Content-Type': 'application/sdp'},
            body: sdp,
          )
          .timeout(const Duration(seconds: 20));
    } on TimeoutException {
      await _closePeerOnly();
      throw Exception(
        'Publish timed out. Check your connection and try again.',
      );
    }
    if (res.statusCode >= 300) {
      await _closePeerOnly();
      throw Exception('Publish failed (${res.statusCode})');
    }

    await pc.setRemoteDescription(
      RTCSessionDescription(res.body, 'answer'),
    );
    return stream;
  }

  Future<void> _closePeerOnly() async {
    try {
      await _pc?.close();
    } catch (_) {}
    _pc = null;
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

  bool toggleMic() {
    final track = _localStream?.getAudioTracks().isNotEmpty == true
        ? _localStream!.getAudioTracks().first
        : null;
    if (track == null) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  bool toggleCamera() {
    final track = _localStream?.getVideoTracks().isNotEmpty == true
        ? _localStream!.getVideoTracks().first
        : null;
    if (track == null) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  /// Flip between front and back cameras on devices that support it.
  Future<void> switchCamera() async {
    final track = _localStream?.getVideoTracks().isNotEmpty == true
        ? _localStream!.getVideoTracks().first
        : null;
    if (track == null) return;
    _facingMode = _facingMode == 'user' ? 'environment' : 'user';
    await Helper.switchCamera(track);
  }

  Future<void> dispose() async {
    try {
      _localStream?.getTracks().forEach((t) {
        try {
          t.stop();
        } catch (_) {}
      });
      await _localStream?.dispose();
      _localStream = null;
      await _pc?.close();
      _pc = null;
    } catch (_) {
      /* noop */
    }
  }
}
