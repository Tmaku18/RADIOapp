import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// Local monitor of the station track for a DJ who is live.
///
/// This player does not activate or retune the audio session. The broadcast
/// session is already play-and-record and routed to the headset; letting
/// just_audio reconfigure it silences the outgoing mic on iOS.
class StationCuePlayer {
  final AudioPlayer _player = AudioPlayer(
    handleInterruptions: false,
    handleAudioSessionActivation: false,
    androidApplyAudioAttributes: false,
  );

  String? _url;

  /// Cut the output immediately. Safe to call when headphones are unplugged
  /// and the route is about to fall back to the speaker.
  void silence() {
    _url = null;
    unawaited(_player.setVolume(0));
    unawaited(_player.pause());
  }

  Future<void> sync({
    required String url,
    required Duration position,
    required bool playing,
  }) async {
    final source = url.trim();
    if (!playing || source.isEmpty) {
      if (_player.playing) {
        try {
          await _player.pause();
        } catch (_) {}
      }
      return;
    }
    try {
      await _player.setVolume(0.85);
      if (_url != source) {
        _url = source;
        await _player.setUrl(source);
        await _player.seek(position);
        await _player.play();
        return;
      }
      final driftMs = (_player.position - position).inMilliseconds.abs();
      if (driftMs > 2500) {
        await _player.seek(position);
      }
      if (!_player.playing) {
        await _player.play();
      }
    } catch (e) {
      debugPrint('Station cue failed: $e');
    }
  }

  Future<void> stop() async {
    _url = null;
    try {
      await _player.stop();
    } catch (_) {}
  }

  Future<void> dispose() async {
    _url = null;
    try {
      await _player.dispose();
    } catch (_) {}
  }
}
