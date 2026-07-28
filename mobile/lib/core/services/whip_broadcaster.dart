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
  RTCRtpSender? _audioSender;
  RTCRtpSender? _videoSender;
  String _facingMode = 'user';
  bool _camBusy = false;

  MediaStream? get localStream => _localStream;

  /// True when the front (selfie) camera is active — used to mirror the local
  /// self-preview without affecting the outgoing stream.
  bool get isFrontCamera => _facingMode == 'user';
  bool get isPublishing => _pc != null;
  bool get hasVideoTrack =>
      _localStream?.getVideoTracks().isNotEmpty == true;

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
      final sender = await pc.addTrack(track, stream);
      _audioSender ??= sender;
    }

    // Always create exactly one video m-line (matches web CameraBroadcaster).
    // When starting audio-only (Live DJ), keep an empty sendonly sender so the
    // host can turn the camera on later via replaceTrack — no renegotiation.
    final videoTracks = stream.getVideoTracks();
    if (videoTracks.isNotEmpty) {
      _videoSender = await pc.addTrack(videoTracks.first, stream);
    } else {
      final tx = await pc.addTransceiver(
        kind: RTCRtpMediaType.RTCRtpMediaTypeVideo,
        init: RTCRtpTransceiverInit(direction: TransceiverDirection.SendOnly),
      );
      _videoSender = tx.sender;
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
    _audioSender = null;
    _videoSender = null;
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

  static double _asDouble(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  /// Instantaneous capture level (0..1) + cumulative energy from WebRTC stats.
  /// Energy that never increases while packets flow = the mic is sending
  /// silence (the classic iOS just_audio/WebRTC session fight).
  Future<({double level, double energy})> micCaptureStats() async {
    final pc = _pc;
    if (pc == null) return (level: 0.0, energy: 0.0);
    var level = 0.0;
    var energy = 0.0;
    try {
      final stats = await pc.getStats();
      for (final report in stats) {
        final values = report.values;
        final kind = (values['kind'] ?? values['mediaType'])?.toString();
        if ((report.type == 'media-source' || report.type == 'track') &&
            (kind == null || kind == 'audio')) {
          final l = _asDouble(values['audioLevel']);
          final e = _asDouble(values['totalAudioEnergy']);
          if (l > level) level = l;
          if (e > energy) energy = e;
        }
      }
    } catch (e) {
      debugPrint('WhipBroadcaster.micCaptureStats: $e');
    }
    return (level: level, energy: energy);
  }

  /// Wait until the mic is capturing REAL audio (energy rising / level > 0),
  /// not just sending RTP packets of silence.
  Future<bool> waitForLiveMicAudio({
    Duration timeout = const Duration(seconds: 5),
  }) async {
    final first = await micCaptureStats();
    var baseline = first.energy;
    if (first.level > 0.0005) return true;
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 450));
      final s = await micCaptureStats();
      if (s.level > 0.0005) return true;
      if (s.energy > baseline + 1e-7) return true;
      if (s.energy > 0 && baseline == 0) baseline = s.energy;
      for (final track in _localStream?.getAudioTracks() ?? const []) {
        track.enabled = true;
      }
    }
    return false;
  }

  /// Tear down and re-acquire the microphone, swapping the fresh track into
  /// the live audio sender. Recovers the known iOS state where getUserMedia
  /// returned a track whose capture unit never started (silent frames).
  Future<bool> restartAudioCapture() async {
    final sender = _audioSender;
    final stream = _localStream;
    if (sender == null || stream == null) return false;
    try {
      final micStream = await navigator.mediaDevices.getUserMedia({
        'audio': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        },
      });
      final newTrack = micStream.getAudioTracks().isNotEmpty
          ? micStream.getAudioTracks().first
          : null;
      if (newTrack == null) return false;
      newTrack.enabled = true;
      await sender.replaceTrack(newTrack);
      for (final old
          in List<MediaStreamTrack>.from(stream.getAudioTracks())) {
        try {
          await stream.removeTrack(old);
        } catch (_) {}
        try {
          await old.stop();
        } catch (_) {}
      }
      await stream.addTrack(newTrack);
      try {
        await Helper.ensureAudioSession();
      } catch (_) {}
      return true;
    } catch (e) {
      debugPrint('WhipBroadcaster.restartAudioCapture: $e');
      return false;
    }
  }

  bool toggleMic() {
    final track = _localStream?.getAudioTracks().isNotEmpty == true
        ? _localStream!.getAudioTracks().first
        : null;
    if (track == null) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  /// Legacy sync toggle — only works when a video track already exists.
  /// Prefer [toggleCameraAsync] for Live DJ (starts camera-off).
  bool toggleCamera() {
    final track = _localStream?.getVideoTracks().isNotEmpty == true
        ? _localStream!.getVideoTracks().first
        : null;
    if (track == null) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  /// Toggle camera on/off. When starting audio-only (no video track yet),
  /// acquires the camera and swaps it into the existing video sender — same
  /// as web CameraBroadcaster — so Live DJ can turn the camera on mid-stream.
  Future<bool> toggleCameraAsync() async {
    final tracks = _localStream?.getVideoTracks() ?? const <MediaStreamTrack>[];
    if (tracks.isNotEmpty) {
      final track = tracks.first;
      if (track.enabled) {
        return setCameraEnabled(false);
      }
      track.enabled = true;
      return true;
    }
    return setCameraEnabled(true);
  }

  /// Enable or disable the camera. Turning off stops the hardware and clears
  /// the sender; turning on re-acquires and replaceTrack's into [_videoSender].
  Future<bool> setCameraEnabled(bool enabled) async {
    final sender = _videoSender;
    final stream = _localStream;
    if (sender == null || stream == null || _camBusy) {
      return hasVideoTrack &&
          (_localStream?.getVideoTracks().first.enabled ?? false);
    }
    _camBusy = true;
    try {
      if (!enabled) {
        try {
          await sender.replaceTrack(null);
        } catch (_) {}
        for (final old in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
          try {
            await stream.removeTrack(old);
          } catch (_) {}
          try {
            await old.stop();
          } catch (_) {}
        }
        return false;
      }

      final camStream = await navigator.mediaDevices.getUserMedia({
        'audio': false,
        'video': {
          'facingMode': _facingMode,
          'mandatory': {'minFrameRate': '24'},
          'optional': [],
        },
      });
      final newTrack = camStream.getVideoTracks().isNotEmpty
          ? camStream.getVideoTracks().first
          : null;
      if (newTrack == null) {
        throw Exception('No camera track available');
      }
      await sender.replaceTrack(newTrack);
      for (final old in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
        try {
          await stream.removeTrack(old);
        } catch (_) {}
        try {
          await old.stop();
        } catch (_) {}
      }
      await stream.addTrack(newTrack);
      // Stop leftover tracks on the temporary getUserMedia stream.
      for (final t in camStream.getTracks()) {
        if (t.id != newTrack.id) {
          try {
            await t.stop();
          } catch (_) {}
        }
      }
      return true;
    } catch (e) {
      debugPrint('WhipBroadcaster.setCameraEnabled: $e');
      rethrow;
    } finally {
      _camBusy = false;
    }
  }

  /// Flip between front and back cameras on devices that support it.
  Future<void> switchCamera() async {
    final track = _localStream?.getVideoTracks().isNotEmpty == true
        ? _localStream!.getVideoTracks().first
        : null;
    if (track == null) return;
    _facingMode = _facingMode == 'user' ? 'environment' : 'user';
    // Prefer a fresh getUserMedia + replaceTrack — more reliable than
    // Helper.switchCamera after a late camera attach.
    final sender = _videoSender;
    final stream = _localStream;
    if (sender == null || stream == null) {
      await Helper.switchCamera(track);
      return;
    }
    try {
      final camStream = await navigator.mediaDevices.getUserMedia({
        'audio': false,
        'video': {
          'facingMode': _facingMode,
          'mandatory': {'minFrameRate': '24'},
          'optional': [],
        },
      });
      final newTrack = camStream.getVideoTracks().first;
      await sender.replaceTrack(newTrack);
      for (final old in List<MediaStreamTrack>.from(stream.getVideoTracks())) {
        try {
          await stream.removeTrack(old);
        } catch (_) {}
        try {
          await old.stop();
        } catch (_) {}
      }
      await stream.addTrack(newTrack);
    } catch (_) {
      // Fall back to in-place switch if getUserMedia fails.
      await Helper.switchCamera(track);
    }
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
      _audioSender = null;
      _videoSender = null;
    } catch (_) {
      /* noop */
    }
  }
}
