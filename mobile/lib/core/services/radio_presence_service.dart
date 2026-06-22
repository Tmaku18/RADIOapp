import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:uuid/uuid.dart';

import '../auth/role_helpers.dart';
import 'audio_player_service.dart';
import 'radio_service.dart';

/// Global listener presence — survives tab switches (web NowPlayingBar parity).
class RadioPresenceService {
  RadioPresenceService._();
  static final RadioPresenceService instance = RadioPresenceService._();

  final RadioService _radio = RadioService();
  Timer? _timer;
  bool _tickInFlight = false;
  String _streamToken = 'npb-${const Uuid().v4()}';
  String _radioId = RadioService.defaultRadioId;
  String? _userRole;
  void Function(Map<String, dynamic> heartbeat)? onHeartbeatResult;

  String get streamToken => _streamToken;

  void configure({String? userRole, String? radioId}) {
    _userRole = userRole;
    if (radioId != null && radioId.trim().isNotEmpty) {
      _radioId = radioId.trim();
    }
  }

  void resetStreamToken() {
    _streamToken = 'npb-${const Uuid().v4()}';
  }

  void start() {
    _timer ??= Timer.periodic(const Duration(seconds: 30), (_) {
      unawaited(_tick());
    });
    unawaited(_tick());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _tick() async {
    if (_tickInFlight) return;
    final player = AudioPlayerService().player;
    final seq = player.sequenceState;
    final tag = seq.currentSource?.tag;
    final media = tag is MediaItem ? tag : null;
    if (media == null) return;

    final songId = media.id;
    if (songId.isEmpty) return;

    final handler = AudioPlayerService.handler;
    final playerState = player.playerState;
    final isTunedIn =
        playerState.playing || handler.userPausedNotifier.value;
    if (!isTunedIn) return;

    _tickInFlight = true;
    try {
      final ts = DateTime.now().toUtc().toIso8601String();
      await _radio.sendPresence(
        streamToken: _streamToken,
        songId: songId,
        timestamp: ts,
        radioId: _radioId,
      );

      if (hasListenerCapability(_userRole)) {
        final res = await _radio.sendHeartbeat(
          streamToken: _streamToken,
          songId: songId,
          timestamp: ts,
          radioId: _radioId,
        );
        if (res != null) {
          onHeartbeatResult?.call(res);
        }
      }
    } finally {
      _tickInFlight = false;
    }
  }
}

/// Starts live radio for guests from welcome / marketing CTAs.
class RadioGuestPlaybackService {
  RadioGuestPlaybackService._();
  static final RadioGuestPlaybackService instance = RadioGuestPlaybackService._();

  final RadioService _radio = RadioService();

  Future<bool> startLiveRadio({String radioId = RadioService.defaultRadioId}) async {
    final res = await _radio.getCurrentTrack(radioId: radioId);
    if (res.noContent || res.track == null) return false;
    final track = res.track!;
    if (track.audioUrl.trim().isEmpty) return false;

    final player = AudioPlayerService().player;
    await player.setAudioSource(
      AudioSource.uri(
        Uri.parse(track.audioUrl),
        tag: MediaItem(
          id: track.id,
          title: track.title,
          artist: track.artistName,
          extras: {
            'source': 'radio',
            'radioId': radioId,
            'songId': track.id,
          },
        ),
      ),
    );
    if (track.positionSeconds > 0) {
      await player.seek(Duration(seconds: track.positionSeconds));
    }
    await AudioPlayerService.handler.setUserPaused(false);
    await player.play();
    unawaited(_radio.reportPlay(track.id, radioId: radioId));

    RadioPresenceService.instance.configure(radioId: radioId);
    RadioPresenceService.instance.start();
    return true;
  }
}

String? songIdFromPlayer(SequenceState? state) {
  final tag = state?.currentSource?.tag;
  if (tag is MediaItem) return tag.id;
  return null;
}
