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

  /// Acquire mic (and optionally camera) so the host can preview before WHIP
  /// negotiation finishes (or if publish fails). Pass [video]: false for
  /// audio-only DJ / radio-booth talk-overs (matches web `startCameraOff`).
  Future<MediaStream> acquireLocalMedia({bool video = true}) async {
    if (_localStream != null) {
      // If we already have a stream but now need video (or vice versa), rebuild.
      final hasVideo = _localStream!.getVideoTracks().isNotEmpty;
      if (hasVideo == video) return _localStream!;
      await dispose();
    }
    _localStream = await navigator.mediaDevices.getUserMedia({
      'audio': true,
      if (video)
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
  ///
  /// Completes only after ICE reaches connected (or a short timeout) so callers
  /// like DJ Booth don't broadcast `mic_on` before Cloudflare has media.
  Future<MediaStream> start(String whipUrl, {bool video = true}) async {
    final stream = await acquireLocalMedia(video: video);
    // Drop any half-open peer from a previous attempt before renegotiating.
    await _closePeerOnly();

    final pc = await createPeerConnection({
      'iceServers': [
        {'urls': 'stun:stun.cloudflare.com:3478'},
      ],
      'sdpSemantics': 'unified-plan',
    });
    _pc = pc;

    // Audio sender(s).
    for (final track in stream.getAudioTracks()) {
      await pc.addTrack(track, stream);
    }

    // Always create exactly one video m-line (matches web CameraBroadcaster).
    // Cloudflare WHIP for DJ booth is published audio-only on web with an empty
    // sendonly video transceiver — omitting it can yield an unplayable ingest.
    final videoTracks = stream.getVideoTracks();
    if (videoTracks.isNotEmpty) {
      await pc.addTrack(videoTracks.first, stream);
    } else {
      // Empty sendonly video m-line — required for Cloudflare WHIP parity with web.
      await pc.addTransceiver(
        kind: RTCRtpMediaType.RTCRtpMediaTypeVideo,
        init: RTCRtpTransceiverInit(direction: TransceiverDirection.SendOnly),
      );
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
    await _waitForConnection(pc);
    // Brief Cloudflare warm-up so WHEP listeners don't connect to an empty
    // input the moment mic_on is broadcast.
    await Future<void>.delayed(const Duration(milliseconds: 800));
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

  Future<void> _waitForConnection(RTCPeerConnection pc) async {
    if (pc.connectionState ==
        RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
      return;
    }
    final completer = Completer<void>();
    final timer = Timer(const Duration(seconds: 10), () {
      if (!completer.isCompleted) {
        // Negotiation succeeded; media may still be connecting. Don't hard-fail
        // — mic_on can still proceed after the warm-up delay.
        completer.complete();
      }
    });
    pc.onConnectionState = (state) {
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected &&
          !completer.isCompleted) {
        completer.complete();
      } else if (state ==
              RTCPeerConnectionState.RTCPeerConnectionStateFailed &&
          !completer.isCompleted) {
        completer.completeError(Exception('WHIP connection failed'));
      }
    };
    try {
      await completer.future;
    } finally {
      timer.cancel();
    }
  }

  /// True when the peer connection reports outbound audio RTP flowing.
  /// Used by the DJ booth to verify the mic is actually reaching Cloudflare
  /// (a connected WHIP session can still carry silence if the OS killed the
  /// capture unit, e.g. after an audio-session reconfigure).
  Future<bool> hasOutboundAudio() async {
    final pc = _pc;
    if (pc == null) return false;
    try {
      final stats = await pc.getStats();
      for (final report in stats) {
        if (report.type != 'outbound-rtp') continue;
        final values = report.values;
        final kind = (values['kind'] ?? values['mediaType'])?.toString();
        if (kind != 'audio') continue;
        final packets = values['packetsSent'];
        final sent = packets is num
            ? packets.toInt()
            : int.tryParse(packets?.toString() ?? '') ?? 0;
        if (sent > 0) return true;
      }
    } catch (_) {}
    return false;
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
