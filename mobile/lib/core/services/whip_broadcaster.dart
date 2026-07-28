import 'dart:async';

import 'package:flutter/foundation.dart';
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
      'audio': {
        'echoCancellation': true,
        'noiseSuppression': true,
        'autoGainControl': true,
      },
      if (video)
        'video': {
          'facingMode': _facingMode,
          'mandatory': {'minFrameRate': '24'},
          'optional': [],
        },
    });
    // Force-enable every audio track — some iOS sessions hand back a disabled
    // track after an audio-session fight with just_audio.
    for (final track in _localStream!.getAudioTracks()) {
      track.enabled = true;
    }
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
    final audioTracks = stream.getAudioTracks();
    if (audioTracks.isEmpty) {
      await _closePeerOnly();
      throw Exception('No microphone track available. Check mic permission.');
    }
    for (final track in audioTracks) {
      track.enabled = true;
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

    // Kick the device list — known flutter_webrtc iOS workaround that wakes a
    // silent first-call mic capture unit.
    try {
      await navigator.mediaDevices.enumerateDevices();
    } catch (_) {}

    // Re-assert tracks enabled after ICE (session changes can flip them).
    for (final track in stream.getAudioTracks()) {
      track.enabled = true;
    }

    try {
      await Helper.ensureAudioSession();
    } catch (_) {}

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
        // — callers can still wait for outbound RTP separately.
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
  Future<bool> hasOutboundAudio() async {
    final pc = _pc;
    if (pc == null) return false;
    try {
      final stats = await pc.getStats();
      for (final report in stats) {
        final type = report.type;
        final values = report.values;
        final kind = (values['kind'] ?? values['mediaType'])?.toString();

        if (type == 'outbound-rtp' && (kind == null || kind == 'audio')) {
          final packets = _asInt(values['packetsSent']);
          final bytes = _asInt(values['bytesSent']);
          if (packets > 0 || bytes > 0) return true;
        }
        // Some iOS builds only expose media-source / track samples.
        if ((type == 'media-source' || type == 'track') &&
            (kind == null || kind == 'audio')) {
          final samples = _asInt(
            values['totalSamplesDuration'] ?? values['audioLevel'],
          );
          if (samples > 0) return true;
        }
      }
    } catch (e) {
      debugPrint('WhipBroadcaster.hasOutboundAudio: $e');
    }
    return false;
  }

  /// Poll until outbound audio RTP is observed, or [timeout] elapses.
  Future<bool> waitForOutboundAudio({
    Duration timeout = const Duration(seconds: 6),
  }) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      if (await hasOutboundAudio()) return true;
      // Nudge capture — re-enable tracks each poll.
      for (final track in _localStream?.getAudioTracks() ?? const []) {
        track.enabled = true;
      }
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
    return hasOutboundAudio();
  }

  static int _asInt(Object? value) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
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
