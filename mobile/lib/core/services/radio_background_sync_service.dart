import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';

import '../brand/brand_assets.dart';
import '../models/track.dart';
import '../models/track_fetch_result.dart';
import '../radio/radio_sync.dart';
import 'audio_player_service.dart';
import 'radio_presence_service.dart';
import 'radio_service.dart';
import 'station_events_service.dart';

/// App-wide radio sync — port of web [RadioBackgroundSync] + ended handler.
class RadioBackgroundSyncService with WidgetsBindingObserver {
  RadioBackgroundSyncService._();
  static final RadioBackgroundSyncService instance =
      RadioBackgroundSyncService._();

  final RadioService _radio = RadioService();
  final AudioPlayer _player = AudioPlayerService().player;

  StreamSubscription<PlayerState>? _playerSub;
  StreamSubscription<DjBoothRealtimeEvent>? _boothSub;
  Timer? _pollTimer;
  bool _started = false;
  bool _syncInFlight = false;
  bool _advanceInFlight = false;
  DateTime _lastSyncSeekAt = DateTime.fromMillisecondsSinceEpoch(0);
  RecentlyAdvancedFrom? _recentlyAdvancedFrom;
  bool _appInBackground = false;

  /// When true, [PlayerScreen] owns sync to avoid duplicate handlers.
  bool playerScreenActive = false;

  String? get _radioId {
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return null;
    final extras = tag.extras;
    if (extras == null || extras['source'] != 'radio') return null;
    final id = extras['radioId']?.toString().trim();
    return (id != null && id.isNotEmpty) ? id : RadioService.defaultRadioId;
  }

  String? get _currentTrackId {
    final tag = _player.sequenceState.currentSource?.tag;
    return tag is MediaItem ? tag.id : null;
  }

  bool get _isRadioActive {
    if (_radioId == null) return false;
    final handler = AudioPlayerService.handler;
    if (handler.userPaused) return false;
    return _player.processingState != ProcessingState.idle;
  }

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _playerSub = _player.playerStateStream.listen(_onPlayerState);
    _boothSub = StationEventsService().djBoothStream.listen(_onDjBoothEvent);
    _schedulePoll();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appInBackground =
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden;
    _schedulePoll();
  }

  void _schedulePoll() {
    _pollTimer?.cancel();
    if (!_isRadioActive || playerScreenActive) return;
    final interval = _appInBackground
        ? const Duration(seconds: 5)
        : const Duration(seconds: 10);
    _pollTimer = Timer.periodic(interval, (_) => unawaited(_syncCurrentTrack()));
  }

  void _onPlayerState(PlayerState state) {
    if (playerScreenActive) return;
    final handler = AudioPlayerService.handler;
    if (handler.userPaused) return;
    if (state.processingState == ProcessingState.completed) {
      unawaited(_handleTrackEnded());
    }
    _schedulePoll();
  }

  void _onDjBoothEvent(DjBoothRealtimeEvent event) {
    if (playerScreenActive) return;
    if (event.type == 'queue_updated') {
      unawaited(_syncCurrentTrack());
    }
  }

  void _markAdvancedFrom(String? trackId) {
    if (trackId == null || trackId.isEmpty) return;
    _recentlyAdvancedFrom = RecentlyAdvancedFrom(
      id: trackId,
      at: DateTime.now(),
    );
  }

  Future<void> _handleTrackEnded() async {
    if (playerScreenActive || _advanceInFlight || _syncInFlight) return;
    final radioId = _radioId;
    if (radioId == null) return;
    _advanceInFlight = true;
    final endedId = _currentTrackId;
    try {
      var res = await _radio.getNextTrack(radioId: radioId);
      if (res.noContent || res.track == null) return;

      if (endedId != null && res.track!.id == endedId) {
        final forced = await _radio.getNextTrack(radioId: radioId, force: true);
        if (!forced.noContent && forced.track != null) {
          res = forced;
        }
      }

      final track = res.track;
      if (track == null || track.audioUrl.trim().isEmpty) return;
      if (isStaleRadioServerTrack(track.id, _recentlyAdvancedFrom)) return;

      _markAdvancedFrom(endedId);
      await _loadTrack(track, res, reportPlay: true);
    } finally {
      _advanceInFlight = false;
    }
  }

  Future<void> _syncCurrentTrack() async {
    if (playerScreenActive || _syncInFlight || _advanceInFlight) return;
    final radioId = _radioId;
    if (radioId == null) return;
    _syncInFlight = true;
    try {
      await StationEventsService().switchStation(radioId);
      RadioPresenceService.instance.configure(radioId: radioId);

      final res = await _radio.getCurrentTrack(radioId: radioId);
      if (res.noContent || res.track == null) return;
      final serverTrack = res.track!;
      if (serverTrack.audioUrl.trim().isEmpty) return;

      if (isStaleRadioServerTrack(serverTrack.id, _recentlyAdvancedFrom)) {
        return;
      }

      final localId = _currentTrackId;
      final trackChanged = localId == null || localId != serverTrack.id;

      if (trackChanged) {
        final position = _player.position.inSeconds;
        final duration =
            _player.duration?.inSeconds ?? serverTrack.durationSeconds;
        if (localId != null &&
            isServerAheadMidSong(
              trackIdentityChanged: true,
              isPlaying: _player.playing,
              userPaused: AudioPlayerService.handler.userPaused,
              currentTimeSeconds: position,
              durationSeconds: duration,
            )) {
          return;
        }
        _markAdvancedFrom(localId);
        await _loadTrack(serverTrack, res, reportPlay: localId != serverTrack.id);
        return;
      }

      if (AudioPlayerService.handler.userPaused) return;

      final localSeconds = _player.position.inSeconds;
      final serverSeconds = serverTrack.positionSeconds;
      final forwardDrift = localSeconds - serverSeconds;
      final backwardDrift = serverSeconds - localSeconds;
      final remaining = (durationOr(serverTrack) - localSeconds).clamp(0, 999999);
      final now = DateTime.now();
      final cooldownOk = now.difference(_lastSyncSeekAt).inSeconds >= 30;

      if (cooldownOk) {
        if (forwardDrift >= 8 && remaining > 12) {
          _lastSyncSeekAt = now;
          await _player.seek(Duration(seconds: serverSeconds));
        } else if (backwardDrift >= 12) {
          _lastSyncSeekAt = now;
          await _player.seek(Duration(seconds: serverSeconds));
        }
      }
    } finally {
      _syncInFlight = false;
    }
  }

  int durationOr(Track track) {
    return _player.duration?.inSeconds ?? track.durationSeconds;
  }

  Future<void> _loadTrack(
    Track track,
    TrackFetchResult result, {
    required bool reportPlay,
  }) async {
    final radioId = _radioId ?? RadioService.defaultRadioId;
    try {
      await AudioPlayerService().loadSource(
        AudioSource.uri(
          Uri.parse(track.audioUrl),
          tag: MediaItem(
            id: track.id,
            title: track.title,
            artist: track.artistName,
            artUri: BrandAssets.mediaArtUri(track.artworkUrl),
            extras: {
              'source': 'radio',
              'radioId': radioId,
              'songId': track.id,
            },
          ),
        ),
        initialPosition: track.positionSeconds > 0
            ? Duration(seconds: track.positionSeconds)
            : null,
      );
    } catch (_) {
      return;
    }
    final handler = AudioPlayerService.handler;
    if (handler.userPaused) {
      await _player.setVolume(0);
    } else {
      await _player.setVolume(1);
      await _player.play();
    }
    if (reportPlay) {
      unawaited(_radio.reportPlay(track.id, radioId: radioId));
    }
  }
}
