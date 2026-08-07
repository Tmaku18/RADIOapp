import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/widgets.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../brand/brand_assets.dart';
import '../env.dart';
import '../models/track.dart';
import '../models/track_fetch_result.dart';
import '../radio/radio_sync.dart';
import 'audio_player_service.dart';
import 'radio_connection_monitor.dart';
import 'radio_presence_service.dart';
import 'radio_service.dart';
import 'station_events_service.dart';

/// App-wide radio sync — port of web [RadioBackgroundSync] + ended handler.
class RadioBackgroundSyncService with WidgetsBindingObserver {
  RadioBackgroundSyncService._();
  static final RadioBackgroundSyncService instance =
      RadioBackgroundSyncService._();

  static const _selectedStationPrefKey = 'selected_radio_station_id';
  static const _defaultBootstrapStationId = 'us-ready-now-rap';

  final RadioService _radio = RadioService();
  final AudioPlayer _player = AudioPlayerService().player;

  StreamSubscription<PlayerState>? _playerSub;
  StreamSubscription<DjBoothRealtimeEvent>? _boothSub;
  Timer? _pollTimer;
  bool _started = false;
  bool _syncInFlight = false;
  bool _advanceInFlight = false;
  bool _bootstrapAttempted = false;
  bool _bootstrapInFlight = false;
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

  bool get _hasRadioSource {
    final tag = _player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    return tag.extras?['source'] == 'radio';
  }

  /// Cold start always opens Ready Now so every launch hears the same home
  /// station first. Mid-session switches still persist for Discover, etc.
  Future<String> _resolveBootstrapStationId() async {
    final stationId = env('RADIO_STATION_ID') ?? _defaultBootstrapStationId;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_selectedStationPrefKey, stationId);
    } catch (_) {
      // Prefs failure must not block audio bootstrap.
    }
    return stationId;
  }

  /// Someone else already owns the shared player, so the cold-start bootstrap
  /// must stand down rather than load a second track over theirs.
  bool get _bootstrapPreempted => playerScreenActive || _hasRadioSource;

  /// Cold-start bootstrap: load and play live radio when the app opens, before
  /// any screen mounts (mirrors web RadioBackgroundSync bar bootstrap).
  Future<void> _bootstrapLiveRadioIfIdle() async {
    if (_bootstrapAttempted || _bootstrapInFlight) return;
    if (_bootstrapPreempted) return;
    if (AudioPlayerService.handler.userPaused) return;

    _bootstrapInFlight = true;
    _bootstrapAttempted = true;
    try {
      final radioId = await _resolveBootstrapStationId();
      // Ownership can flip during any of these awaits: this runs from main()
      // while the UI is still starting, so PlayerScreen may mount and begin its
      // own load. Two loads into the shared player is what made the first
      // seconds after launch jump between songs.
      if (_bootstrapPreempted) return;
      await StationEventsService().switchStation(radioId);
      RadioPresenceService.instance.configure(radioId: radioId);

      final res = await _radio.getCurrentTrack(radioId: radioId);
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
      if (res.noContent || res.track == null) {
        _bootstrapAttempted = false;
        return;
      }
      final track = res.track!;
      if (track.audioUrl.trim().isEmpty) {
        _bootstrapAttempted = false;
        return;
      }
      if (_bootstrapPreempted) return;

      await _loadTrack(track, res, reportPlay: true, radioId: radioId);
      if (track.transportPaused && _player.playing) {
        await _player.pause();
      }
      _schedulePoll();
    } catch (_) {
      _bootstrapAttempted = false;
    } finally {
      _bootstrapInFlight = false;
    }
  }

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _playerSub = _player.playerStateStream.listen(_onPlayerState);
    _boothSub = StationEventsService().djBoothStream.listen(_onDjBoothEvent);
    RadioConnectionMonitor.instance.addRestoreListener(_onConnectionRestored);
    AudioPlayerService.handler.onMusicPlaybackFailure = _recoverPlayback;
    unawaited(_bootstrapLiveRadioIfIdle());
    _schedulePoll();
  }

  /// Rebuild playback after the stream died mid-song.
  ///
  /// Always re-fetches from `/radio/current` rather than reusing the old URL:
  /// signed song URLs expire after an hour, so a stale one would just 403
  /// again. Retries with backoff because the failure is usually a network drop
  /// that needs a moment to clear.
  Future<void> _recoverPlayback() async {
    if (!_hasRadioSource) return;
    if (AudioPlayerService.handler.userPaused) return;
    final radioId = _radioId;
    if (radioId == null) return;

    for (var attempt = 0; attempt < 3; attempt++) {
      await Future<void>.delayed(Duration(seconds: 2 * (attempt + 1)));
      if (!_hasRadioSource || AudioPlayerService.handler.userPaused) return;

      final res = await _radio.getCurrentTrack(radioId: radioId);
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
      final track = res.track;
      if (res.noContent || track == null || track.audioUrl.trim().isEmpty) {
        continue;
      }

      await _loadTrack(track, res, reportPlay: false, radioId: radioId);
      if (_player.processingState != ProcessingState.idle) return;
    }
  }

  /// Service came back: re-read the live position immediately instead of
  /// waiting out the poll interval, so the catch-up starts right away.
  Future<void> _onConnectionRestored() async {
    if (playerScreenActive || !_hasRadioSource) return;
    await _syncCurrentTrack();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final wasBackground = _appInBackground;
    _appInBackground =
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden;
    _schedulePoll();
    // Returning from background: catch up immediately when this service owns
    // sync (PlayerScreen does the same while it's active).
    if (wasBackground &&
        state == AppLifecycleState.resumed &&
        !playerScreenActive) {
      unawaited(_syncCurrentTrack());
    }
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
    switch (event.type) {
      case 'mic_on':
        // Background listeners must hear the DJ too — not only while the
        // player screen is open.
        if (!_hasRadioSource) return;
        final url = event.streamUrl;
        if (url != null && url.isNotEmpty) {
          unawaited(
            AudioPlayerService.handler.startVoiceOverlay(
              url,
              duckVolume: event.duckVolume ?? 0.25,
            ),
          );
        }
        break;
      case 'mic_off':
        unawaited(AudioPlayerService.handler.stopVoiceOverlay());
        break;
      case 'duck_volume':
        if (event.duckVolume != null) {
          unawaited(
            AudioPlayerService.handler.setDuckVolume(event.duckVolume!),
          );
        }
        break;
      case 'queue_updated':
        unawaited(_syncCurrentTrack());
        break;
      default:
        break;
    }
  }

  /// Mirror of PlayerScreen booth overlay handling for background playback:
  /// start/stop the DJ talk-over from the polled track's `dj_overlay`.
  Future<void> _applyDjOverlay(Track track) async {
    final handler = AudioPlayerService.handler;
    if (handler.userPaused) return;
    final overlay = track.djOverlay;
    final overlayUrl = overlay?.streamUrl;
    if (overlay != null &&
        overlay.active &&
        overlayUrl != null &&
        overlayUrl.isNotEmpty) {
      await handler.startVoiceOverlay(
        overlayUrl,
        duckVolume: overlay.duckVolume,
      );
    } else {
      await handler.stopVoiceOverlay();
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
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
      if (res.noContent || res.track == null) return;

      if (endedId != null && res.track!.id == endedId) {
        final forced = await _radio.getNextTrack(
          radioId: radioId,
          force: true,
          after: endedId,
        );
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
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
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
        // Seconds from the end: the boundary handler is about to make this same
        // switch, so don't discard the buffer for a track that's finishing.
        // Requires audio to be actually flowing (`ready`) — a buffering-stalled
        // decoder never reaches the boundary handler, so it must hard-switch.
        final localDuration = _player.duration?.inSeconds;
        if (localId != null &&
            localDuration != null &&
            shouldDeferTrackSwitchToBoundary(
              localSeconds: position,
              durationSeconds: localDuration,
              isPlaying: _player.playing &&
                  _player.processingState == ProcessingState.ready,
            )) {
          return;
        }
        _markAdvancedFrom(localId);
        await _loadTrack(serverTrack, res, reportPlay: localId != serverTrack.id);
        return;
      }

      if (AudioPlayerService.handler.userPaused) return;

      await _applyDjOverlay(serverTrack);

      await _applyLiveSync(serverTrack);
    } finally {
      _syncInFlight = false;
    }
  }

  /// Reconcile local playback with the live timeline without glitching.
  ///
  /// Seeks are the audible failure mode on weak links — they drop the buffer
  /// and restart buffering — so [decideRadioSync] prefers a rate nudge and
  /// never seeks backwards mid-song.
  Future<void> _applyLiveSync(Track serverTrack) async {
    final decision = decideRadioSync(
      localSeconds: _player.position.inSeconds,
      targetSeconds: liveTargetSeconds(serverTrack),
      durationSeconds: durationOr(serverTrack),
      isBuffering: _player.processingState == ProcessingState.buffering,
      connectionDegraded: RadioConnectionMonitor.instance.current.isImpaired,
      currentSpeed: _player.speed,
    );

    switch (decision.action) {
      case RadioSyncAction.none:
        return;
      case RadioSyncAction.nudge:
        await _player.setSpeed(decision.speed);
      case RadioSyncAction.seek:
        final now = DateTime.now();
        if (now.difference(_lastSyncSeekAt).inSeconds < 30) return;
        _lastSyncSeekAt = now;
        if (_player.speed != 1.0) await _player.setSpeed(1.0);
        await _player.seek(Duration(seconds: decision.targetSeconds!));
    }
  }

  int durationOr(Track track) {
    return _player.duration?.inSeconds ?? track.durationSeconds;
  }

  Future<void> _loadTrack(
    Track track,
    TrackFetchResult result, {
    required bool reportPlay,
    String? radioId,
  }) async {
    final effectiveRadioId =
        radioId ?? _radioId ?? env('RADIO_STATION_ID') ?? _defaultBootstrapStationId;
    // Start where the song is *now*, not where it was when the server replied —
    // on a slow link those differ by seconds.
    final startAt = liveTargetSeconds(track);
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
              'radioId': effectiveRadioId,
              'songId': track.id,
            },
          ),
        ),
        initialPosition: startAt > 0 ? Duration(seconds: startAt) : null,
      );
    } catch (_) {
      return;
    }
    // A stale rate from an interrupted catch-up must not carry into the new
    // song.
    if (_player.speed != 1.0) await _player.setSpeed(1.0);
    final handler = AudioPlayerService.handler;
    // Never hardcode volume to 1 — that blasts after temporary mutes/ducks.
    await handler.applyOutputVolume();
    if (!handler.userPaused) {
      await _player.play();
    }
    if (reportPlay) {
      unawaited(_radio.reportPlay(track.id, radioId: effectiveRadioId));
    }
    if (!playerScreenActive) {
      await _applyDjOverlay(track);
    }
  }
}
