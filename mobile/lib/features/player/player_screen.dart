import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:audio_service/audio_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/track.dart';
import '../../core/models/track_fetch_result.dart';
import '../../core/services/api_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/payments_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/chat_service.dart';
import '../../core/services/venue_ads_service.dart';
import '../../core/services/station_events_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/venue_ad.dart';
import '../../core/env.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/theme/networx_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import 'widgets/chat_panel.dart';
import 'widgets/synced_lyrics_panel.dart';

class _StationOption {
  const _StationOption({
    required this.id,
    required this.genre,
    required this.city,
  });

  final String id;
  final String genre;
  final String city;
}

const List<_StationOption> _stationOptions = <_StationOption>[
  _StationOption(
    id: 'us-rap',
    genre: 'New School Rap Radio',
    city: 'New York',
  ),
  _StationOption(
    id: 'us-old-school-rap',
    genre: 'Old School Rap Radio',
    city: 'Detroit',
  ),
  _StationOption(
    id: 'us-rap-clean',
    genre: 'Clean Rap Radio',
    city: 'Charlotte',
  ),
  _StationOption(
    id: 'us-ready-now-rap',
    genre: 'Ready Now Radio',
    city: 'Houston',
  ),
  _StationOption(id: 'us-hip-hop', genre: 'Hip Hop', city: 'Atlanta'),
  _StationOption(id: 'us-country', genre: 'Country', city: 'Nashville'),
  _StationOption(id: 'us-rock', genre: 'Rock', city: 'Chicago'),
  _StationOption(id: 'us-metal', genre: 'Metal Radio', city: 'Cleveland'),
  _StationOption(id: 'us-pop', genre: 'Pop', city: 'Los Angeles'),
  _StationOption(id: 'us-edm', genre: 'EDM', city: 'Las Vegas'),
  _StationOption(id: 'us-rnb', genre: 'R&B', city: 'New Orleans'),
  _StationOption(id: 'us-podcasts', genre: 'Podcasts', city: 'Seattle'),
  _StationOption(
    id: 'us-spoken-word',
    genre: 'Spoken Word',
    city: 'Washington',
  ),
  _StationOption(id: 'us-comedian', genre: 'Comedian', city: 'Austin'),
  _StationOption(id: 'us-gospel', genre: 'Gospel', city: 'Dallas'),
  _StationOption(id: 'us-classical', genre: 'Classical Radio', city: 'Boston'),
  _StationOption(id: 'us-emo', genre: 'Emo Radio', city: 'Denver'),
  _StationOption(
    id: 'us-ai-created',
    genre: 'AI Created Radio',
    city: 'San Francisco',
  ),
  _StationOption(id: 'us-beats', genre: 'Beats Radio', city: 'Miami'),
  _StationOption(id: 'us-freestyle', genre: 'Freestyle Radio', city: 'Phoenix'),
  _StationOption(
    id: 'us-instrumental',
    genre: 'Instrumental Radio',
    city: 'Portland',
  ),
  _StationOption(id: 'us-lofi', genre: 'Lo-Fi Radio', city: 'San Diego'),
  _StationOption(id: 'us-jazz', genre: 'Jazz Radio', city: 'Kansas City'),
  _StationOption(
    id: 'us-audiobook',
    genre: 'Audiobook Radio',
    city: 'Minneapolis',
  ),
  _StationOption(id: 'us-spanish', genre: 'Spanish Radio', city: 'Miami'),
  _StationOption(id: 'us-afrobeats', genre: 'Afro-Beats Radio', city: 'Houston'),
];

const String _selectedStationPrefKey = 'selected_radio_station_id';

/// Neutral starting point for song temperature (matches backend TEMP_BASELINE).
const int _kTempBaseline = 50;

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen>
    with SingleTickerProviderStateMixin {
  final AudioPlayer _audioPlayer = AudioPlayerService().player;
  final RadioService _radioService = RadioService();
  final VenueAdsService _venueAds = VenueAdsService();
  final SongsService _songs = SongsService();
  final PaymentsService _payments = PaymentsService();
  Track? _currentTrack;
  SongAccess? _songAccess;
  bool _isBuying = false;
  bool _isPlaying = false;
  bool _isLoading = true;
  bool _hasVoted = false;
  String? _selectedReaction;
  bool _isVoting = false;
  String? _lastVotedPlayId;
  bool _noContent = false;
  String? _noContentMessage;
  VenueAd? _ad;
  app_user.User? _me;
  String? _risingStarText;
  StreamSubscription? _risingStarSub;
  StreamSubscription? _djBoothSub;
  bool _rippleActive = false;
  Timer? _presenceTimer;
  Timer? _trackSyncTimer;
  Timer? _trackBoundaryTimer;
  bool _globalTransportPaused = false;
  /// User-facing music volume (0..1). The DJ talk-over ducks below this via the
  /// audio handler's separate voice player; we restore to this level when the
  /// overlay ends.
  final double _userVolume = 1.0;
  StreamSubscription<PlayerState>? _playerStateSub;
  bool _presenceTickInFlight = false;
  bool _trackSyncInFlight = false;
  bool _trackAdvanceInFlight = false;
  DateTime _lastSyncSeekAt = DateTime(2000);
  /// Song we just advanced away from; ignore server "current" for ~12s so pollers
  /// don't jump the listener backward (or reload mid-crossfade).
  ({String id, DateTime at})? _recentlyAdvancedFrom;
  String _radioId = env('RADIO_STATION_ID') ?? 'us-ready-now-rap';
  final String _streamToken = 'mobile-${DateTime.now().millisecondsSinceEpoch}';
  late final AnimationController _rippleController;

  _StationOption get _activeStation {
    for (final station in _stationOptions) {
      if (station.id == _radioId) return station;
    }
    return const _StationOption(
      id: 'us-ready-now-rap',
      genre: 'Ready Now Radio',
      city: 'Houston',
    );
  }

  @override
  void initState() {
    super.initState();
    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    _loadMe();
    _initializeStationAndPlayback();
    _risingStarSub = StationEventsService().risingStarStream.listen((event) {
      if (!mounted) return;
      final percent = event.conversion != null
          ? (event.conversion! * 100).toStringAsFixed(1)
          : '5';
      setState(() {
        _risingStarText =
            '${event.artistName} just hit $percent% conversion on “${event.songTitle}”.';
      });
      HapticFeedback.heavyImpact();
      _triggerButterflyRipple();
      Future.delayed(const Duration(seconds: 8), () {
        if (!mounted) return;
        setState(() => _risingStarText = null);
      });
    });
    _djBoothSub = StationEventsService().djBoothStream.listen(_onDjBoothEvent);
    _playerStateSub = _audioPlayer.playerStateStream.listen((state) {
      final handler = AudioPlayerService.handler;
      if (mounted && !handler.userPaused && _isPlaying != state.playing) {
        setState(() => _isPlaying = state.playing);
      }
      if (state.processingState == ProcessingState.completed &&
          !handler.userPaused) {
        _handleTrackEnded();
      }
    });
    _startPresenceTimer();
    _startTrackSyncTimer();
  }

  Future<void> _initializeStationAndPlayback() async {
    await _restoreStationSelection();
    await _loadInitialTrack();
    await _loadVenueAd();
    await StationEventsService().start(stationId: _radioId);
  }

  Future<void> _restoreStationSelection() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_selectedStationPrefKey)?.trim();
      if (stored != null && stored.isNotEmpty) {
        // New School Rap was emptied; migrate saved selection to Ready Now.
        _radioId = stored == 'us-rap' ? 'us-ready-now-rap' : stored;
      }
    } catch (_) {
      // Ignore storage failures and keep env/default station.
    }
  }

  Future<void> _persistStationSelection(String stationId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_selectedStationPrefKey, stationId);
    } catch (_) {
      // Ignore storage failures.
    }
  }

  Future<void> _loadMe() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      if (!mounted) return;
      setState(() => _me = me);
    } catch (_) {
      // ignore
    }
  }

  Future<void> _loadVenueAd() async {
    try {
      final ad = await _venueAds.getCurrent(stationId: _radioId);
      if (!mounted) return;
      setState(() => _ad = ad);
    } catch (_) {
      // ignore
    }
  }

  Future<void> _changeStation(_StationOption station) async {
    if (station.id == _radioId) return;
    setState(() {
      _radioId = station.id;
      _isLoading = true;
      _isPlaying = false;
      _currentTrack = null;
      _selectedReaction = null;
      _hasVoted = false;
      _lastVotedPlayId = null;
      _isVoting = false;
      _noContent = false;
      _noContentMessage = null;
      _songAccess = null;
    });
    await _persistStationSelection(station.id);
    await _audioPlayer.stop();
    StationEventsService().stop();
    await StationEventsService().start(stationId: station.id);
    await _loadVenueAd();
    await _loadInitialTrack();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Tuned to ${station.genre} (${station.city})')),
    );
  }

  Future<void> _openStationPicker() async {
    final selected = await showModalBottomSheet<_StationOption>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => _StationPickerSheet(
        currentId: _radioId,
        api: ApiService(),
      ),
    );
    if (selected != null) {
      await _changeStation(selected);
    }
  }

  Future<void> _loadInitialTrack() async {
    setState(() {
      _isLoading = true;
      _noContent = false;
      _noContentMessage = null;
    });

    final res = await _radioService.getCurrentTrack(radioId: _radioId);
    if (!mounted) return;
    if (res.noContent) {
      setState(() {
        _isLoading = false;
        _noContent = true;
        _noContentMessage = res.message;
      });
      return;
    }

    final track = res.track;
    if (track == null || track.audioUrl.trim().isEmpty) {
      setState(() => _isLoading = false);
      return;
    }

    await _loadAndPlay(track, res);
  }

  Future<void> _loadAndPlay(
    Track track,
    TrackFetchResult result, {
    bool reportPlay = true,
  }) async {
    await _audioPlayer.setAudioSource(
      AudioSource.uri(
        Uri.parse(track.audioUrl),
        tag: MediaItem(
          id: track.id,
          title: track.title,
          artist: track.artistName,
          artUri: BrandAssets.mediaArtUri(track.artworkUrl),
        ),
      ),
    );
    // Best-effort sync to server position if available.
    if (track.positionSeconds > 0) {
      await _audioPlayer.seek(Duration(seconds: track.positionSeconds));
    }
    await _applyMainVolumeForTrack(track);
    if (AudioPlayerService.handler.userPaused) {
      // Muted: keep the stream live & advancing (silent) so this device stays
      // synced with everyone else. Don't start if admin transport is paused.
      await _audioPlayer.setVolume(0);
      if (!_globalTransportPaused) {
        await _audioPlayer.play();
      }
    } else {
      await _audioPlayer.play();
    }
    if (reportPlay) {
      await _radioService.reportPlay(track.id, radioId: _radioId);
    }
    if (!mounted) return;

    final playId = track.playId;
    final alreadyVoted =
        playId != null && playId.isNotEmpty && playId == _lastVotedPlayId;

    setState(() {
      _currentTrack = track;
      _isPlaying = true;
      _isLoading = false;
      _hasVoted = alreadyVoted;
      if (!alreadyVoted) {
        _selectedReaction = null;
      }
      _songAccess = null;
    });
    _scheduleTrackBoundarySync(track);
    _presenceTick();
    _loadSongAccess(track.id);
    await _applyBoothState(track);
  }

  /// Fetch purchase/sale status for the current song so the player can show a
  /// "Buy" button (or an "Owned" badge), mirroring the web RadioPlayer.
  Future<void> _loadSongAccess(String songId) async {
    if (songId.isEmpty) return;
    try {
      final access = await _songs.getAccess(songId);
      if (!mounted || _currentTrack?.id != songId) return;
      setState(() => _songAccess = access);
    } catch (_) {
      if (!mounted || _currentTrack?.id != songId) return;
      setState(() => _songAccess = null);
    }
  }

  Future<void> _buySong() async {
    final track = _currentTrack;
    if (track == null || _isBuying) return;
    if (_me == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Log in to buy songs.')),
      );
      return;
    }
    setState(() => _isBuying = true);
    try {
      final res = await _payments.buySong(songId: track.id);
      final url = (res['url'] ?? res['checkoutUrl'])?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Could not start checkout.');
      }
      final uri = Uri.tryParse(url);
      if (uri != null && await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Complete your purchase in the browser. Your song unlocks once payment finishes.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Purchase failed: $e')));
    } finally {
      if (mounted) setState(() => _isBuying = false);
    }
  }

  /// React immediately to live DJ booth events (pushed over Supabase Realtime)
  /// so listeners hear the admin go live without waiting for the 30s radio poll.
  Future<void> _onDjBoothEvent(DjBoothRealtimeEvent event) async {
    final handler = AudioPlayerService.handler;
    switch (event.type) {
      case 'mic_on':
        final url = event.hlsUrl;
        if (url != null && url.trim().isNotEmpty) {
          await handler.startVoiceOverlay(
            url,
            duckVolume: event.duckVolume ?? 0.25,
          );
        }
        break;
      case 'mic_off':
        await handler.stopVoiceOverlay();
        break;
      case 'duck_volume':
        if (event.duckVolume != null) {
          await handler.setDuckVolume(event.duckVolume!);
        }
        break;
      default:
        break;
    }
  }

  Future<void> _applyMainVolumeForTrack(Track? track) async {
    // The handler restores to this base level whenever no DJ overlay is active.
    await AudioPlayerService.handler.setBaseMusicVolume(
      _userVolume.clamp(0.0, 1.0),
    );
  }

  Future<void> _applyBoothState(Track track) async {
    if (AudioPlayerService.handler.userPaused) {
      await AudioPlayerService.handler.setUserPaused(true);
      if (mounted) setState(() => _isPlaying = false);
      return;
    }

    if (track.transportPaused) {
      _globalTransportPaused = true;
      if (_audioPlayer.playing) {
        await _audioPlayer.pause();
        if (mounted) setState(() => _isPlaying = false);
      }
    } else if (_globalTransportPaused) {
      _globalTransportPaused = false;
      if (!_audioPlayer.playing && _currentTrack != null) {
        await _audioPlayer.play();
        if (mounted) setState(() => _isPlaying = true);
      }
    }

    // Keep the handler's base music volume in sync with the user's level.
    await _applyMainVolumeForTrack(track);

    // Layer the live DJ talk-over over the music (ducking the music) via the
    // handler's separate voice player. Stop it when the booth goes off-air.
    final overlay = track.djOverlay;
    final overlayUrl = overlay?.hlsUrl;
    if (overlay != null &&
        overlay.active &&
        overlayUrl != null &&
        overlayUrl.trim().isNotEmpty) {
      await AudioPlayerService.handler.startVoiceOverlay(
        overlayUrl,
        duckVolume: overlay.duckVolume,
      );
    } else {
      await AudioPlayerService.handler.stopVoiceOverlay();
    }
  }

  /// Transition to [track]. The radio music uses a single content player, so we
  /// hand off directly rather than crossfade. Kept as a named method because the
  /// sync path calls it when the live track changes mid-playback.
  Future<void> _crossfadeToTrack(
    Track track,
    TrackFetchResult result, {
    bool reportPlay = true,
  }) async {
    await _loadAndPlay(track, result, reportPlay: reportPlay);
  }

  void _markAdvancedFrom(String? trackId) {
    if (trackId == null || trackId.isEmpty) return;
    _recentlyAdvancedFrom = (id: trackId, at: DateTime.now());
  }

  bool _isStaleServerTrack(String serverTrackId) {
    final adv = _recentlyAdvancedFrom;
    if (adv == null || adv.id != serverTrackId) return false;
    return DateTime.now().difference(adv.at).inSeconds < 12;
  }

  bool _isNearLocalTrackEnd({int thresholdSeconds = 8}) {
    final track = _currentTrack;
    if (track == null) return true;
    final duration =
        _audioPlayer.duration?.inSeconds ?? track.durationSeconds;
    if (duration <= 0) return true;
    final position = _audioPlayer.position.inSeconds;
    return position >= duration - thresholdSeconds;
  }

  /// End-of-song advance — mirrors web `handleTrackEnded`.
  ///
  /// Starts non-force: that returns the song the shared queue is currently on
  /// (the next track, or — for a normal-length song — the freshly-advanced
  /// one), keeping every device in sync without each one independently
  /// skipping. If the server still reports the song that JUST ended (its clock
  /// lags because the encoded audio is shorter than the catalog duration),
  /// nudge it once with a force-advance. The server debounces concurrent nudges
  /// so synced devices converge on one song instead of skipping ahead.
  Future<void> _handleTrackEnded() async {
    if (!mounted || _trackAdvanceInFlight || _trackSyncInFlight) return;
    _trackAdvanceInFlight = true;
    _trackBoundaryTimer?.cancel();
    final endedId = _currentTrack?.id;
    try {
      var res = await _radioService.getNextTrack(
        radioId: _radioId,
      );
      if (!mounted) return;

      if (res.noContent) {
        setState(() {
          _isLoading = false;
          _isPlaying = false;
          _currentTrack = null;
          _noContent = true;
          _noContentMessage = res.message;
        });
        return;
      }

      // Server still on the song that just ended (its clock lags a short audio
      // file). Nudge the shared queue forward; the server debounces concurrent
      // nudges so all synced devices converge on the same next song.
      if (endedId != null && res.track != null && res.track!.id == endedId) {
        final forced = await _radioService.getNextTrack(
          radioId: _radioId,
          force: true,
        );
        if (!mounted) return;
        if (!forced.noContent && forced.track != null) {
          res = forced;
        }
      }

      final track = res.track;
      if (track == null || track.audioUrl.trim().isEmpty) return;

      final previousId = _currentTrack?.id;
      if (previousId != null && previousId != track.id) {
        _markAdvancedFrom(previousId);
      }

      setState(() {
        _isLoading = true;
        _noContent = false;
        _noContentMessage = null;
        _hasVoted = false;
        _selectedReaction = null;
        _isVoting = false;
      });
      await _crossfadeToTrack(track, res, reportPlay: true);
    } catch (_) {
      // Keep playing; periodic sync will retry.
    } finally {
      _trackAdvanceInFlight = false;
    }
  }

  void _scheduleTrackBoundarySync(Track track) {
    _trackBoundaryTimer?.cancel();
    var remainingMs = track.timeRemainingMs;
    if (remainingMs <= 0 && track.durationSeconds > 0) {
      final estimated = (track.durationSeconds - track.positionSeconds).clamp(
        0,
        1 << 30,
      );
      remainingMs = estimated * 1000;
    }
    if (remainingMs <= 0) return;

    final safeMs = (remainingMs + 250).clamp(500, 15 * 60 * 1000).toInt();
    _trackBoundaryTimer = Timer(Duration(milliseconds: safeMs), () {
      if (!mounted) return;
      // Only rotate when local playback is actually near the end. The server clock
      // can run ahead of the device decoder and would otherwise cut songs short.
      if (_isNearLocalTrackEnd()) {
        _handleTrackEnded();
      } else {
        final local = _currentTrack;
        if (local != null) _scheduleTrackBoundarySync(local);
      }
    });
  }

  void _startTrackSyncTimer() {
    _trackSyncTimer?.cancel();
    _trackSyncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _syncCurrentTrack();
    });
  }

  Future<void> _syncCurrentTrack() async {
    if (!mounted || _trackSyncInFlight || _trackAdvanceInFlight) return;
    _trackSyncInFlight = true;
    try {
      final res = await _radioService.getCurrentTrack(radioId: _radioId);
      if (!mounted) return;

      if (res.noContent) {
        setState(() {
          _isLoading = false;
          _isPlaying = false;
          _currentTrack = null;
          _noContent = true;
          _noContentMessage = res.message;
        });
        return;
      }

      final serverTrack = res.track;
      if (serverTrack == null || serverTrack.audioUrl.trim().isEmpty) return;

      final localTrack = _currentTrack;

      if (_isStaleServerTrack(serverTrack.id)) {
        await _applyBoothState(serverTrack);
        return;
      }

      final trackChanged =
          localTrack == null || localTrack.id != serverTrack.id;

      if (trackChanged) {
        // Server queue moved on but we're still mid-song locally — don't jump.
        if (localTrack != null && !_isNearLocalTrackEnd()) {
          await _applyBoothState(serverTrack);
          return;
        }

        setState(() {
          _isLoading = true;
          _noContent = false;
          _noContentMessage = null;
          _hasVoted = false;
          _selectedReaction = null;
          _isVoting = false;
        });
        _markAdvancedFrom(localTrack?.id);
        await (_isPlaying && localTrack != null
            ? _crossfadeToTrack(
                serverTrack,
                res,
                reportPlay: true,
              )
            : _loadAndPlay(
                serverTrack,
                res,
                reportPlay: localTrack?.id != serverTrack.id,
              ));
        return;
      }

      final localSeconds = _audioPlayer.position.inSeconds;
      final serverSeconds = serverTrack.positionSeconds;
      final drift = (localSeconds - serverSeconds).abs();
      final now = DateTime.now();
      final cooldownOk =
          now.difference(_lastSyncSeekAt).inSeconds >= 30;
      if (drift >= 8 && cooldownOk) {
        _lastSyncSeekAt = now;
        await _audioPlayer.seek(Duration(seconds: serverSeconds));
      }
      setState(() {
        _currentTrack = localTrack.copyWith(
          listenerCount: serverTrack.listenerCount,
          fireVotes: serverTrack.fireVotes,
          shitVotes: serverTrack.shitVotes,
          temperaturePercent: serverTrack.temperaturePercent,
        );
        _isLoading = false;
        _noContent = false;
      });
      _scheduleTrackBoundarySync(serverTrack);
      await _applyBoothState(serverTrack);
    } catch (_) {
      // Keep current playback state on transient sync failures.
    } finally {
      _trackSyncInFlight = false;
    }
  }

  void _startPresenceTimer() {
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _presenceTick();
    });
  }

  Future<void> _presenceTick() async {
    if (!mounted || _presenceTickInFlight) return;
    final track = _currentTrack;
    // A muted listener is still tuned in (the stream stays live), so keep
    // counting them — mirror the web behavior.
    final isTunedIn = _isPlaying || AudioPlayerService.handler.userPaused;
    if (!isTunedIn || track == null || track.id.isEmpty) return;

    _presenceTickInFlight = true;
    try {
      await _radioService.sendHeartbeat(
        streamToken: _streamToken,
        songId: track.id,
        timestamp: DateTime.now().toUtc().toIso8601String(),
        radioId: _radioId,
      );

      final latest = await _radioService.getCurrentTrack(radioId: _radioId);
      final latestTrack = latest.track;
      if (!mounted || latestTrack == null || latestTrack.id != track.id) return;

      setState(() {
        _currentTrack = track.copyWith(
          listenerCount: latestTrack.listenerCount,
          fireVotes: latestTrack.fireVotes,
          shitVotes: latestTrack.shitVotes,
          temperaturePercent: latestTrack.temperaturePercent,
        );
      });
    } catch (_) {
      // Best effort only; do not block playback on presence errors.
    } finally {
      _presenceTickInFlight = false;
    }
  }

  Future<void> _react(String reaction) async {
    final track = _currentTrack;
    if (track == null || _isVoting) return;
    if (_me == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Log in to vote.')));
      return;
    }

    final playId = track.playId;
    if (playId == null || playId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voting is unavailable for this play.')),
      );
      return;
    }

    setState(() {
      _isVoting = true;
    });

    try {
      HapticFeedback.lightImpact();
      final result = await _radioService.submitReaction(
        songId: track.id,
        playId: playId,
        reaction: reaction,
      );
      final previousReaction =
          ((result?['previousReaction'] as String?) ?? _selectedReaction);
      String? serverReaction = result?['reaction'] as String?;
      if (serverReaction != 'fire' && serverReaction != 'shit') {
        // Backward-compatible fallback if backend returns the old shape.
        final alreadyVoted = result?['alreadyVoted'] == true;
        if (alreadyVoted) {
          serverReaction = previousReaction;
        } else {
          serverReaction = reaction;
        }
      }
      if (serverReaction == 'fire') {
        await _radioService.ensureLiked(track.id);
      }

      var fireVotes = track.fireVotes;
      var shitVotes = track.shitVotes;
      if (previousReaction == 'fire') fireVotes -= 1;
      if (previousReaction == 'shit') shitVotes -= 1;
      if (serverReaction == 'fire') fireVotes += 1;
      if (serverReaction == 'shit') shitVotes += 1;
      fireVotes = fireVotes < 0 ? 0 : fireVotes;
      shitVotes = shitVotes < 0 ? 0 : shitVotes;
      // Mirror the server formula (clamp(0..100, baseline + fire - shit)) so the
      // optimistic value matches web instead of jumping to 100% on a single vote.
      final temperaturePercent =
          (_kTempBaseline + fireVotes - shitVotes).clamp(0, 100).toInt();

      if (!mounted) return;
      setState(() {
        _currentTrack = track.copyWith(
          fireVotes: fireVotes,
          shitVotes: shitVotes,
          temperaturePercent: temperaturePercent,
        );
        _hasVoted = serverReaction != null;
        _selectedReaction = serverReaction;
        _lastVotedPlayId = serverReaction != null ? playId : null;
        _isVoting = false;
      });

      if (mounted) {
        final changedToFire =
            previousReaction != 'fire' && serverReaction == 'fire';
        final changedToShit =
            previousReaction != 'shit' && serverReaction == 'shit';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              serverReaction == null
                  ? 'Vote removed.'
                  : changedToFire
                  ? '🔥 Vote locked in. Saved to your library.'
                  : changedToShit
                  ? '💩 Vote locked in.'
                  : 'Vote updated.',
            ),
            duration: Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isVoting = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _togglePlayPause() async {
    final handler = AudioPlayerService.handler;
    final shouldPlay = handler.userPaused;
    try {
      await handler.setUserPaused(!shouldPlay);
      if (!mounted) return;
      setState(() => _isPlaying = shouldPlay);
      if (shouldPlay) {
        _presenceTick();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isPlaying = !handler.userPaused && _audioPlayer.playing);
      }
    }
  }

  @override
  void dispose() {
    _playerStateSub?.cancel();
    _risingStarSub?.cancel();
    _djBoothSub?.cancel();
    _presenceTimer?.cancel();
    _trackSyncTimer?.cancel();
    _trackBoundaryTimer?.cancel();
    StationEventsService().stop();
    _rippleController.dispose();
    super.dispose();
  }

  void _triggerButterflyRipple() {
    if (!mounted) return;
    _rippleController.stop();
    _rippleController.reset();
    setState(() => _rippleActive = true);
    _rippleController.forward().whenComplete(() {
      if (!mounted) return;
      setState(() => _rippleActive = false);
    });
  }

  void _openRoom(BuildContext providerContext) {
    final chatService = providerContext.read<ChatService>();
    showModalBottomSheet<void>(
      context: providerContext,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return ChangeNotifierProvider.value(
          value: chatService,
          child: SafeArea(
            child: SizedBox(
              height: MediaQuery.of(context).size.height * 0.78,
              child: ChatPanel(
                currentSongId: _currentTrack?.id,
                currentSongTitle: _currentTrack?.title,
                currentRadioId: _radioId,
                isExpanded: true,
                fillHeightWhenExpanded: true,
                expandedHeight: 9999,
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(radioId: _radioId),
      child: Builder(
        builder: (providerContext) {
          return Scaffold(
            appBar: AppBar(
              title: Text('Radio · ${_activeStation.genre}'),
              actions: [
                TextButton.icon(
                  onPressed: _openStationPicker,
                  icon: const Icon(Icons.swap_horiz),
                  label: const Text('Change'),
                ),
              ],
            ),
            body: Stack(
              children: [
                _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _noContent
                    ? _NoContent(
                        message: _noContentMessage,
                        onRetry: _loadInitialTrack,
                        onChangeStation: _openStationPicker,
                      )
                    : _currentTrack == null
                    ? const Center(child: Text('No track playing'))
                    : _PlayerBody(
                        track: _currentTrack!,
                        stationLabel: _activeStation.genre,
                        onChangeStation: _openStationPicker,
                        risingStarText: _risingStarText,
                        ad: _ad,
                        isPlaying: _isPlaying,
                        hasVoted: _hasVoted,
                        isVoting: _isVoting,
                        selectedReaction: _selectedReaction,
                        canVote: (_currentTrack?.playId ?? '').isNotEmpty,
                        fireVotes: _currentTrack?.fireVotes ?? 0,
                        shitVotes: _currentTrack?.shitVotes ?? 0,
                        temperaturePercent:
                            _currentTrack?.temperaturePercent ?? 0,
                        songAccess: _songAccess,
                        isBuying: _isBuying,
                        onBuy: _buySong,
                        onReact: _react,
                        onPlayPause: _togglePlayPause,
                        onEnterRoom: () => _openRoom(providerContext),
                        audioPlayer: _audioPlayer,
                      ),
                if (_rippleActive)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: _ButterflyRippleOverlay(
                        progress: _rippleController,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ButterflyRippleOverlay extends StatelessWidget {
  const _ButterflyRippleOverlay({required this.progress});

  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final cyan = NetworxTokens.electricCyan;
    final lime = NetworxTokens.radioactiveLime;
    return AnimatedBuilder(
      animation: progress,
      builder: (context, _) {
        final t = Curves.easeOut.transform(progress.value.clamp(0.0, 1.0));
        final a1 = (1.0 - t) * 0.55;
        final a2 = (1.0 - t) * 0.38;
        final scale = 0.85 + (t * 0.35);

        return Container(
          color: Colors.transparent,
          child: Stack(
            children: [
              Positioned.fill(
                child: Opacity(
                  opacity: (1.0 - t) * 0.35,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: const Alignment(0, -0.1),
                        radius: 1.0,
                        colors: [
                          cyan.withValues(alpha: a1),
                          lime.withValues(alpha: a2),
                          scheme.surface.withValues(alpha: 0.0),
                        ],
                        stops: const [0.0, 0.35, 0.8],
                      ),
                    ),
                  ),
                ),
              ),
              Center(
                child: Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 360,
                    height: 360,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: cyan.withValues(alpha: (1.0 - t) * 0.22),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: cyan.withValues(alpha: (1.0 - t) * 0.28),
                          blurRadius: 80,
                          spreadRadius: 18,
                        ),
                        BoxShadow(
                          color: lime.withValues(alpha: (1.0 - t) * 0.18),
                          blurRadius: 140,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _NoContent extends StatelessWidget {
  final String? message;
  final VoidCallback onRetry;
  final VoidCallback onChangeStation;
  const _NoContent({
    required this.message,
    required this.onRetry,
    required this.onChangeStation,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('📻', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              Text(
                'Station Offline',
                style: Theme.of(
                  context,
                ).textTheme.headlineSmall?.copyWith(fontFamily: 'Lora'),
              ),
              const SizedBox(height: 8),
              Text(
                message ?? 'No songs are currently available.',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: surfaces.textSecondary),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: onChangeStation,
                icon: const Icon(Icons.swap_horiz),
                label: const Text('Change station'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _roleLabel(String role) {
  switch (role) {
    case 'cover_art':
      return 'Cover art';
    case 'video':
      return 'Video';
    case 'production':
      return 'Production';
    case 'photo':
      return 'Photo';
    default:
      return 'Credits';
  }
}

class _VenueAdCard extends StatelessWidget {
  final VenueAd ad;
  const _VenueAdCard({required this.ad});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Card(
      child: InkWell(
        onTap: ad.linkUrl == null || ad.linkUrl!.isEmpty
            ? null
            : () async {
                final uri = Uri.tryParse(ad.linkUrl!);
                if (uri != null) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
        borderRadius: BorderRadius.circular(16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 5,
                child: CachedNetworkImage(
                  imageUrl: ad.imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (context, url, error) => Container(
                    color: surfaces.elevated,
                    alignment: Alignment.center,
                    child: Text(
                      'Venue partner',
                      style: TextStyle(color: surfaces.textSecondary),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Text(
                    'Venue Partner',
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlayerBody extends StatelessWidget {
  final Track track;
  final String stationLabel;
  final VoidCallback onChangeStation;
  final String? risingStarText;
  final VenueAd? ad;
  final bool isPlaying;
  final bool hasVoted;
  final bool isVoting;
  final String? selectedReaction;
  final bool canVote;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final SongAccess? songAccess;
  final bool isBuying;
  final VoidCallback onBuy;
  final Future<void> Function(String reaction) onReact;
  final VoidCallback onPlayPause;
  final VoidCallback onEnterRoom;
  final AudioPlayer audioPlayer;

  const _PlayerBody({
    required this.track,
    required this.stationLabel,
    required this.onChangeStation,
    required this.risingStarText,
    required this.ad,
    required this.isPlaying,
    required this.hasVoted,
    required this.isVoting,
    required this.selectedReaction,
    required this.canVote,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.songAccess,
    required this.isBuying,
    required this.onBuy,
    required this.onReact,
    required this.onPlayPause,
    required this.onEnterRoom,
    required this.audioPlayer,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget albumArt() {
      return AspectRatio(
        aspectRatio: 1,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(gradient: surfaces.signatureGradient),
              ),
              if (BrandAssets.displayArtworkUrl(track.artworkUrl) != null)
                CachedNetworkImage(
                  imageUrl: BrandAssets.displayArtworkUrl(track.artworkUrl)!,
                  fit: BoxFit.cover,
                  placeholder: (context, url) =>
                      const Center(child: CircularProgressIndicator()),
                  errorWidget: (context, url, error) => Image.asset(
                    BrandAssets.logoCyanAsset,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Image.asset(BrandAssets.logoCyanAsset, fit: BoxFit.cover),
              if (track.isLiveBroadcast)
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [surfaces.roseGold, scheme.primary],
                      ),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: [
                        BoxShadow(
                          color: surfaces.roseGold.withValues(alpha: 0.35),
                          blurRadius: 18,
                        ),
                      ],
                    ),
                    child: const Text(
                      'NOW LIVE',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    Widget glassPanel({required Widget child, double padding = 16}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: surfaces.glassBlur,
            sigmaY: surfaces.glassBlur,
          ),
          child: Container(
            padding: EdgeInsets.all(padding),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(
                color: Colors.white.withValues(
                  alpha: surfaces.glassBorderOpacity,
                ),
              ),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            child: child,
          ),
        ),
      );
    }

    Widget buyAction() {
      final access = songAccess;
      if (access?.owned == true) {
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.30)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 18, color: scheme.primary),
              const SizedBox(width: 8),
              Text(
                'Owned · in your library',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
      }

      final forSale = access?.forSale != false;
      final label = isBuying
          ? 'Starting…'
          : !forSale
          ? 'Not for sale'
          : access != null
          ? 'Buy ${_formatSongPrice(access.priceCents)}'
          : 'Buy song';

      return SizedBox(
        width: double.infinity,
        child: FilledButton.tonalIcon(
          onPressed: (!forSale || isBuying) ? null : onBuy,
          icon: isBuying
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.shopping_cart_outlined, size: 18),
          label: Text(label),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 720;
        final isShortScreen = !isWide && constraints.maxHeight < 760;
        final panelPadding = isShortScreen ? 12.0 : 16.0;
        final sectionGap = isShortScreen ? 8.0 : 12.0;
        final titleGap = isShortScreen ? 4.0 : 6.0;
        final metaGap = isShortScreen ? 6.0 : 8.0;
        final beforeProgressGap = isShortScreen ? 10.0 : 14.0;
        final afterProgressGap = isShortScreen ? 8.0 : 10.0;
        final outerPadding = isShortScreen ? 12.0 : 16.0;
        final controlsIconSize = isShortScreen ? 48.0 : 52.0;
        final compactTargetHeight =
            constraints.maxHeight * (ad != null ? 0.30 : 0.38);
        final compactArtSize = math.min(
          constraints.maxWidth,
          compactTargetHeight.clamp(180.0, 340.0).toDouble(),
        );
        final art = SizedBox(
          width: isWide ? 320 : compactArtSize,
          child: albumArt(),
        );
        final details = glassPanel(
          padding: panelPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Station: $stationLabel',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: surfaces.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: onChangeStation,
                    icon: const Icon(Icons.swap_horiz),
                    label: const Text('Change station'),
                    style: isShortScreen
                        ? OutlinedButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                          )
                        : null,
                  ),
                ],
              ),
              SizedBox(height: sectionGap),
              if (risingStarText != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: scheme.primary.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Butterfly Ripple',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.primary,
                          letterSpacing: 0.8,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        risingStarText!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: surfaces.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: sectionGap),
              ],
              Text(
                track.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.headlineSmall?.copyWith(fontFamily: 'Lora'),
              ),
              SizedBox(height: titleGap),
              GestureDetector(
                onTap: () {
                  ApiService().post('analytics/profile-click', {
                    'songId': track.id,
                  });
                  final artistId = track.artistId;
                  if (artistId != null &&
                      artistId.isNotEmpty &&
                      context.mounted) {
                    Navigator.pushNamed(
                      context,
                      AppRoutes.artistProfile,
                      arguments: artistId,
                    );
                  }
                },
                child: Text(
                  track.artistName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: surfaces.textSecondary,
                  ),
                ),
              ),
              SizedBox(height: metaGap),
              Row(
                children: [
                  Icon(
                    Icons.people_alt_outlined,
                    size: 16,
                    color: surfaces.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Live listeners: ${isPlaying && track.listenerCount < 1 ? 1 : track.listenerCount}',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: surfaces.textSecondary,
                    ),
                  ),
                ],
              ),
              if (track.pinnedCatalysts.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...track.pinnedCatalysts.take(2).map((c) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Text(
                          '${_roleLabel(c.role)} by ',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: surfaces.textMuted,
                                letterSpacing: 0.3,
                              ),
                        ),
                        Expanded(
                          child: Text(
                            c.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              SizedBox(height: beforeProgressGap),
              StreamBuilder<Duration>(
                stream: audioPlayer.positionStream,
                builder: (context, snap) {
                  final pos = snap.data ?? Duration.zero;
                  final dur = audioPlayer.duration ?? Duration.zero;
                  final value = (dur.inMilliseconds <= 0)
                      ? 0.0
                      : (pos.inMilliseconds / dur.inMilliseconds).clamp(
                          0.0,
                          1.0,
                        );
                  return Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 4,
                          value: value,
                          backgroundColor: scheme.onSurface.withValues(
                            alpha: 0.12,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatMmSs(pos),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                          Text(
                            _formatMmSs(dur),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
              SizedBox(height: afterProgressGap),
              SyncedLyricsPanel(
                songId: track.id,
                positionStream: audioPlayer.positionStream,
                currentPosition: () => audioPlayer.position,
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerHighest.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: scheme.onSurface.withValues(alpha: 0.14),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Song temperature',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: surfaces.textSecondary),
                        ),
                        Text(
                          '$temperaturePercent%',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: scheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        minHeight: 7,
                        value: (temperaturePercent.clamp(0, 100)) / 100,
                        backgroundColor: scheme.onSurface.withValues(
                          alpha: 0.12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [Text('💩 $shitVotes'), Text('🔥 $fireVotes')],
                    ),
                  ],
                ),
              ),
              SizedBox(height: afterProgressGap),
              buyAction(),
              SizedBox(height: afterProgressGap),
              Row(
                children: [
                  IconButton(
                    onPressed: onPlayPause,
                    iconSize: controlsIconSize,
                    icon: Icon(
                      isPlaying ? Icons.pause_circle : Icons.play_circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Spacer(),
                  IconButton(
                    onPressed: onEnterRoom,
                    tooltip: 'Enter the Room',
                    icon: const Icon(Icons.forum_outlined),
                  ),
                  FilledButton.tonal(
                    style: FilledButton.styleFrom(
                      backgroundColor: selectedReaction == 'shit'
                          ? scheme.errorContainer
                          : null,
                      foregroundColor: selectedReaction == 'shit'
                          ? scheme.onErrorContainer
                          : null,
                    ),
                    onPressed: (!canVote || isVoting)
                        ? null
                        : () => onReact('shit'),
                    child: isVoting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('💩'),
                  ),
                  const SizedBox(width: 6),
                  FilledButton.tonal(
                    style: FilledButton.styleFrom(
                      backgroundColor: selectedReaction == 'fire'
                          ? scheme.primaryContainer
                          : null,
                      foregroundColor: selectedReaction == 'fire'
                          ? scheme.onPrimaryContainer
                          : null,
                    ),
                    onPressed: (!canVote || isVoting)
                        ? null
                        : () => onReact('fire'),
                    child: isVoting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('🔥'),
                  ),
                ],
              ),
            ],
          ),
        );

        return SingleChildScrollView(
          padding: EdgeInsets.all(outerPadding),
          child: isWide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    art,
                    SizedBox(width: outerPadding),
                    Expanded(child: details),
                  ],
                )
              : Column(
                  children: [
                    if (ad != null) ...[
                      _VenueAdCard(ad: ad!),
                      SizedBox(height: sectionGap),
                    ],
                    art,
                    SizedBox(height: outerPadding),
                    details,
                  ],
                ),
        );
      },
    );
  }
}

String _formatMmSs(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$m:$s';
}

/// Formats a cents amount as a dollar price, dropping a trailing ".00"
/// (e.g. 99 → "$0.99", 100 → "$1"). Mirrors the web RadioPlayer's price label.
String _formatSongPrice(int cents) {
  final text = (cents / 100).toStringAsFixed(2);
  return '\$${text.endsWith('.00') ? text.substring(0, text.length - 3) : text}';
}

// ---------------------------------------------------------------------------
// Station picker bottom-sheet with sort & favorites
// ---------------------------------------------------------------------------

const String _favStationsPrefKey = 'favorite_station_ids';

enum _StationSort { alpha, songs, favorites }

class _StationPickerSheet extends StatefulWidget {
  final String currentId;
  final ApiService api;
  const _StationPickerSheet({required this.currentId, required this.api});

  @override
  State<_StationPickerSheet> createState() => _StationPickerSheetState();
}

class _StationPickerSheetState extends State<_StationPickerSheet> {
  _StationSort _sort = _StationSort.songs;
  Set<String> _favs = {};
  Map<String, int> _counts = {};
  bool _loadingCounts = true;

  @override
  void initState() {
    super.initState();
    _loadFavs();
    _loadCounts();
  }

  Future<void> _loadFavs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_favStationsPrefKey) ?? [];
    if (mounted) setState(() => _favs = raw.toSet());
  }

  Future<void> _saveFavs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_favStationsPrefKey, _favs.toList());
  }

  Future<void> _loadCounts() async {
    try {
      final res = await widget.api.get('songs/station-counts');
      if (res is Map<String, dynamic>) {
        final raw = (res['counts'] as Map?)?.cast<String, dynamic>() ?? {};
        final parsed = <String, int>{};
        for (final e in raw.entries) {
          parsed[e.key] = (e.value is int) ? e.value as int : 0;
        }
        if (mounted) setState(() => _counts = parsed);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingCounts = false);
  }

  void _toggleFav(String id) {
    setState(() {
      if (_favs.contains(id)) {
        _favs.remove(id);
      } else {
        _favs.add(id);
      }
    });
    _saveFavs();
  }

  List<_StationOption> get _sorted {
    final list = List<_StationOption>.from(_stationOptions);
    switch (_sort) {
      case _StationSort.alpha:
        list.sort((a, b) => a.genre.compareTo(b.genre));
      case _StationSort.songs:
        list.sort(
            (a, b) => (_counts[b.id] ?? 0).compareTo(_counts[a.id] ?? 0));
      case _StationSort.favorites:
        list.sort((a, b) {
          final af = _favs.contains(a.id) ? 1 : 0;
          final bf = _favs.contains(b.id) ? 1 : 0;
          if (af != bf) return bf - af;
          return a.genre.compareTo(b.genre);
        });
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final stations = _sorted;

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            const ListTile(
              title: Text('Change station'),
              subtitle: Text('Pick a genre to tune into'),
            ),
            // Sort chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text(
                    'Sort: ',
                    style: TextStyle(
                      color: scheme.outline,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 4),
                  _sortChip('A–Z', _StationSort.alpha),
                  const SizedBox(width: 6),
                  _sortChip('Most Songs', _StationSort.songs),
                  const SizedBox(width: 6),
                  _sortChip('Favorites', _StationSort.favorites),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: stations.length,
                itemBuilder: (context, idx) {
                  final station = stations[idx];
                  final active = station.id == widget.currentId;
                  final isFav = _favs.contains(station.id);
                  final count = _counts[station.id] ?? 0;
                  return ListTile(
                    leading: Icon(
                      active
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                      color: active ? scheme.primary : null,
                    ),
                    title: Text(station.genre),
                    subtitle: Text(
                      _loadingCounts
                          ? '${station.city} (National)'
                          : count > 0
                              ? '$count song${count != 1 ? 's' : ''} · ${station.city}'
                              : 'No songs yet · ${station.city}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            isFav ? Icons.star : Icons.star_border,
                            color: isFav ? Colors.amber : scheme.outline,
                          ),
                          onPressed: () => _toggleFav(station.id),
                          visualDensity: VisualDensity.compact,
                        ),
                        if (active)
                          Icon(Icons.check, color: scheme.primary),
                      ],
                    ),
                    onTap: () => Navigator.pop(context, station),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sortChip(String label, _StationSort value) {
    final active = _sort == value;
    return GestureDetector(
      onTap: () => setState(() => _sort = value),
      child: Chip(
        label: Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w600 : null),
        ),
        backgroundColor: active
            ? Theme.of(context).colorScheme.secondaryContainer
            : null,
        padding: EdgeInsets.zero,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
