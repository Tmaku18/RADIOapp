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
import '../../core/radio/radio_sync.dart';
import '../../core/services/api_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/song_purchase_flow.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/chat_service.dart';
import '../../core/services/venue_ads_service.dart';
import '../../core/services/radio_background_sync_service.dart';
import '../../core/services/radio_connection_monitor.dart';
import '../../core/services/radio_presence_service.dart';
import '../../core/services/station_events_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/venue_ad.dart';
import '../../core/env.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/analytics/analytics_metrics.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../dimension/floating_album_scene.dart';
import 'widgets/radio_up_next_queue.dart';
import 'widgets/chat_panel.dart';
import 'widgets/synced_lyrics_panel.dart';
import '../pro_radio/widgets/add_to_playlist_sheet.dart';

class _StationOption {
  const _StationOption({
    required this.id,
    required this.genre,
  });

  final String id;
  final String genre;
}

const List<_StationOption> _stationOptions = <_StationOption>[
  _StationOption(id: 'us-ready-now-rap', genre: 'Ready Now Radio'),
  _StationOption(id: 'us-rap', genre: 'New School Rap Radio'),
  _StationOption(id: 'us-old-school-rap', genre: 'Old School Rap Radio'),
  _StationOption(id: 'us-rap-clean', genre: 'Clean Rap Radio'),
  _StationOption(id: 'us-hip-hop', genre: 'Hip Hop'),
  _StationOption(id: 'us-country', genre: 'Country'),
  _StationOption(id: 'us-rock', genre: 'Rock'),
  _StationOption(id: 'us-metal', genre: 'Metal Radio'),
  _StationOption(id: 'us-pop', genre: 'Pop'),
  _StationOption(id: 'us-kids-friendly', genre: 'Kids Friendly Radio'),
  _StationOption(id: 'us-testing-grounds', genre: 'Testing Grounds Radio'),
  _StationOption(id: 'us-rideshare', genre: 'Rideshare Radio'),
  _StationOption(id: 'us-edm', genre: 'EDM'),
  _StationOption(id: 'us-rnb', genre: 'R&B'),
  _StationOption(id: 'us-podcasts', genre: 'Podcasts'),
  _StationOption(id: 'us-spoken-word', genre: 'Spoken Word'),
  _StationOption(id: 'us-comedian', genre: 'Comedian'),
  _StationOption(id: 'us-gospel', genre: 'Gospel'),
  _StationOption(id: 'us-classical', genre: 'Classical Radio'),
  _StationOption(id: 'us-emo', genre: 'Emo Radio'),
  _StationOption(id: 'us-ai-created', genre: 'AI Created Radio'),
  _StationOption(id: 'us-beats', genre: 'Beats Radio'),
  _StationOption(id: 'us-freestyle', genre: 'Freestyle Radio'),
  _StationOption(id: 'us-instrumental', genre: 'Instrumental Radio'),
  _StationOption(id: 'us-lofi', genre: 'Lo-Fi Radio'),
  _StationOption(id: 'us-jazz', genre: 'Jazz Radio'),
  _StationOption(id: 'us-audiobook', genre: 'Audiobook Radio'),
  _StationOption(id: 'us-spanish', genre: 'Spanish Radio'),
  _StationOption(id: 'us-afrobeats', genre: 'Afro-Beats Radio'),
  _StationOption(id: 'us-dj-mixes', genre: 'DJ Mixes Radio'),
];

const String _selectedStationPrefKey = 'selected_radio_station_id';

/// Neutral starting point for song temperature (matches backend TEMP_BASELINE).
const int _kTempBaseline = 50;

/// Station tuning state shared by every mounted [PlayerScreen].
///
/// The home shell keeps a [PlayerScreen] alive inside its IndexedStack while
/// the mini radio bar, notifications and Pro-Radio all push a second
/// full-screen instance on top of it. When each instance tracked its own
/// station id and switch generation, the two could drive the shared audio
/// player toward *different* stations — every sync tick one instance reloaded
/// its station's song over the other's, and at track end both fired `/next`
/// (and force-advances) for two stations at once. Listeners heard it as the
/// radio randomly changing songs and genres right after switching stations.
class _StationTuner {
  static String? radioId;
  static int generation = 0;
  static bool switchInFlight = false;
}

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key, this.onOpenNavDrawer, this.onUpload});

  /// Opens the app's left navigation drawer (shown as a hamburger in the bar).
  final VoidCallback? onOpenNavDrawer;

  /// Shown for Gem / Catalyst / Admin — web dashboard header Upload CTA.
  final VoidCallback? onUpload;

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  /// Mounted instances in stack order (home-tab instance first, pushed
  /// full-screen instances after it). Also serves the role the old instance
  /// counter had: the background sync flag clears only when this empties.
  static final List<_PlayerScreenState> _mounted = <_PlayerScreenState>[];

  /// Only the top-most mounted instance drives the shared player (sync polls,
  /// end-of-track advance, booth overlays). A buried instance stays passive —
  /// two active drivers is what made the radio flip between stations.
  bool get _isSyncDriver => _mounted.isNotEmpty && identical(_mounted.last, this);

  final AudioPlayer _audioPlayer = AudioPlayerService().player;
  final RadioService _radioService = RadioService();
  final VenueAdsService _venueAds = VenueAdsService();
  final SongsService _songs = SongsService();
  Track? _currentTrack;
  SongAccess? _songAccess;
  bool _isBuying = false;
  bool _isPlaying = false;
  bool _isLoading = true;
  bool _hasVoted = false;
  String? _selectedReaction;
  bool _isVoting = false;
  bool _isFavorite = false;
  bool _favoriteBusy = false;
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
  /// don't jump the listener backward (or reload mid-handoff).
  ({String id, DateTime at})? _recentlyAdvancedFrom;
  late final AnimationController _rippleController;

  /// Shared across instances (see [_StationTuner]) so a station switch made in
  /// a pushed player also invalidates the home-tab instance's in-flight work.
  int get _stationSwitchGeneration => _StationTuner.generation;
  int _nextStationSwitchGeneration() => ++_StationTuner.generation;

  /// Set from the moment the listener picks a station until its audio is live.
  /// Pollers must stand down for that window: a request issued against the
  /// previous station would otherwise land afterwards and load its song over
  /// the new one. Shared across instances and mirrored to the background sync.
  bool get _stationSwitchInFlight => _StationTuner.switchInFlight;
  set _stationSwitchInFlight(bool value) {
    _StationTuner.switchInFlight = value;
    RadioBackgroundSyncService.instance.stationSwitchInFlight = value;
  }

  String get _radioId =>
      _StationTuner.radioId ?? env('RADIO_STATION_ID') ?? 'us-ready-now-rap';
  set _radioId(String value) => _StationTuner.radioId = value;

  _StationOption get _activeStation {
    for (final station in _stationOptions) {
      if (station.id == _radioId) return station;
    }
    return const _StationOption(
      id: 'us-ready-now-rap',
      genre: 'Ready Now Radio',
    );
  }

  @override
  void initState() {
    super.initState();
    _mounted.add(this);
    RadioBackgroundSyncService.instance.playerScreenActive = true;
    WidgetsBinding.instance.addObserver(this);
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
      // Only advance the live queue when the shared player is still on radio.
      // Discography/sample (public profile, etc.) must not trigger radio skip.
      if (state.processingState == ProcessingState.completed &&
          !handler.userPaused &&
          _hasLiveRadioSource) {
        _handleTrackEnded();
      }
    });
    _startTrackStatsTimer();
    _startTrackSyncTimer();
    // Catch up the moment service returns instead of waiting out the poll.
    RadioConnectionMonitor.instance.addRestoreListener(_onConnectionRestored);
    RadioConnectionMonitor.instance.state.addListener(_onConnectionStateChanged);
  }

  /// Playing from the buffer but no longer able to vouch for being in sync.
  bool get _connectionImpaired =>
      RadioConnectionMonitor.instance.current.isImpaired;

  Future<void> _onConnectionRestored() async {
    if (!mounted) return;
    await _syncCurrentTrack();
  }

  void _onConnectionStateChanged() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Returning from background: refresh auth (likes/votes need a valid
      // Bearer), reload profile if needed, and catch up to the live queue.
      unawaited(_onAppResumed());
    }
  }

  Future<void> _onAppResumed() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken(forceRefresh: false);
    } catch (_) {}
    if (_me == null) {
      await _loadMe();
    }
    await _syncCurrentTrack();
  }

  Future<void> _initializeStationAndPlayback() async {
    try {
      await _restoreStationSelection();
      final trackFuture = _radioService.getCurrentTrack(radioId: _radioId);
      final adFuture = _venueAds.getCurrent(stationId: _radioId);
      final eventsFuture = StationEventsService().start(stationId: _radioId);
      final results = await Future.wait<Object?>([
        trackFuture,
        adFuture,
        eventsFuture,
      ]);
      if (!mounted) return;
      final ad = results[1] as VenueAd?;
      setState(() => _ad = ad);
      final res = results[0] as TrackFetchResult;
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
        // Bootstrap may already be playing; recover UI via a sync pass.
        setState(() => _isLoading = false);
        unawaited(_syncCurrentTrack());
        return;
      }
      // Cold-start bootstrap may already have live radio playing. Adopt it and
      // let the sync pass reconcile instead of loading a second copy over it —
      // reloading here restarted the audio and, if a song boundary fell between
      // the two fetches, dropped the listener onto a different track.
      if (_hasLiveRadioSource) {
        setState(() => _isLoading = false);
        unawaited(_syncCurrentTrack());
        return;
      }
      await _loadAndPlay(track, res);
    } catch (e) {
      if (!mounted) return;
      // Don't blank the screen if cold-start bootstrap already has radio audio.
      if (_hasLiveRadioSource) {
        setState(() {
          _isLoading = false;
          _noContent = false;
        });
        unawaited(_syncCurrentTrack());
        return;
      }
      setState(() {
        _isLoading = false;
        _noContent = true;
        _noContentMessage = 'Could not start radio. Tap retry.';
      });
    }
  }

  bool get _hasLiveRadioSource {
    final tag = _audioPlayer.sequenceState.currentSource?.tag;
    return tag is MediaItem && tag.extras?['source'] == 'radio';
  }

  /// Track id of whatever source is loaded in the shared player right now.
  String? _loadedTrackId() {
    final tag = _audioPlayer.sequenceState.currentSource?.tag;
    return tag is MediaItem ? tag.id : null;
  }

  /// True when another feature (public profile, sample, Discover) owns the
  /// shared player. Radio sync must stand down so it doesn't interrupt them.
  bool get _nonRadioOwnsPlayer {
    final tag = _audioPlayer.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    final source = tag.extras?['source']?.toString();
    return source != null && source.isNotEmpty && source != 'radio';
  }

  /// Cold app open starts on Ready Now, but a *second* mounted instance (mini
  /// bar tap, notification, Pro-Radio "open full player") must adopt whatever
  /// station is already live. Resetting to the bootstrap default here is what
  /// used to yank listeners back to Ready Now — and left the two instances
  /// fighting over the shared player — whenever the full player was pushed
  /// after a station switch.
  Future<void> _restoreStationSelection() async {
    final stationId = _StationTuner.radioId ??
        _liveSourceRadioId() ??
        env('RADIO_STATION_ID') ??
        'us-ready-now-rap';
    _radioId = stationId;
    await _persistStationSelection(stationId);
  }

  /// Station named by the radio source currently loaded in the shared player,
  /// or null when the player is idle or owned by a non-radio feature.
  String? _liveSourceRadioId() {
    final tag = _audioPlayer.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return null;
    if (tag.extras?['source'] != 'radio') return null;
    final id = tag.extras?['radioId']?.toString().trim();
    return (id == null || id.isEmpty) ? null : id;
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
      RadioPresenceService.instance.configure(
        userRole: me?.role,
        radioId: _radioId,
      );
    } catch (_) {
      // ignore
    }
  }

  /// True when an in-flight radio request belongs to a station the listener has
  /// since left (or the screen went away). Applying such a response would swap
  /// the audio back to the previous station.
  bool _stationContextLost(int switchId, String radioId) =>
      !mounted || switchId != _stationSwitchGeneration || radioId != _radioId;

  void _announceTunedTo(_StationOption station) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Tuned to ${station.genre}')),
    );
  }

  Future<void> _changeStation(_StationOption station) async {
    if (station.id == _radioId) return;
    final switchId = _nextStationSwitchGeneration();
    _stationSwitchInFlight = true;
    _trackBoundaryTimer?.cancel();
    // Stop polling until the new station is live; a tick landing mid-switch
    // would fetch and load the station we are leaving.
    _trackSyncTimer?.cancel();
    _recentlyAdvancedFrom = null;
    // Tuning away and back should hear the station as it is now, not skip what
    // this device happened to play the last time it was here.
    RadioFinishedPlays.instance.clearStation(_radioId);

    try {
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

      unawaited(_persistStationSelection(station.id));
      RadioPresenceService.instance.configure(
        userRole: _me?.role,
        radioId: station.id,
      );
      // Drop any live DJ overlay; setAudioSource below replaces the music stream
      // without a full stop() so ExoPlayer keeps its decoder warm.
      unawaited(AudioPlayerService.handler.stopVoiceOverlay());

      final trackFuture = _radioService.getCurrentTrack(radioId: station.id);
      final adFuture = _venueAds.getCurrent(stationId: station.id);
      final eventsFuture = StationEventsService().switchStation(station.id);

      final results = await Future.wait<Object?>([
        trackFuture,
        adFuture,
        eventsFuture,
      ]);
      if (_stationContextLost(switchId, station.id)) return;

      final res = results[0] as TrackFetchResult;
      final ad = results[1] as VenueAd?;
      setState(() => _ad = ad);

      if (res.noContent) {
        setState(() {
          _isLoading = false;
          _noContent = true;
          _noContentMessage = res.message;
        });
        if (mounted) _announceTunedTo(station);
        return;
      }

      final track = res.track;
      if (track == null || track.audioUrl.trim().isEmpty) {
        setState(() => _isLoading = false);
        return;
      }

      await _loadAndPlay(
        track,
        res,
        switchId: switchId,
        radioId: station.id,
      );
      if (_stationContextLost(switchId, station.id)) return;
      if (mounted) _announceTunedTo(station);
    } finally {
      // A newer switch owns the flags now — leave them set for that one.
      if (switchId == _stationSwitchGeneration) {
        _stationSwitchInFlight = false;
        if (mounted) _startTrackSyncTimer();
      }
    }
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
    RadioConnectionMonitor.instance.reportRequestResult(
      networkError: res.networkError,
    );
    if (!mounted) return;
    // Nothing is playing yet on a cold start, so showing the retry card is
    // correct here even for a network failure.
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

  /// [switchId] / [radioId] identify the station this track was fetched for.
  /// They are re-checked around every await so a reply that arrives after the
  /// listener retunes is dropped instead of overriding the new station.
  Future<void> _loadAndPlay(
    Track track,
    TrackFetchResult result, {
    bool reportPlay = true,
    int? switchId,
    String? radioId,
  }) async {
    final expectedSwitchId = switchId ?? _stationSwitchGeneration;
    final expectedRadioId = radioId ?? _radioId;
    if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;

    final audio = AudioPlayerService();
    Object? lastError;
    var applied = false;
    // Start where the song is *now*. On a slow link the server's snapshot is
    // already seconds old by the time it reaches us.
    final startAt = liveTargetSeconds(track);
    for (var attempt = 0; attempt < 3; attempt++) {
      if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;
      try {
        applied = await audio.loadSource(
          AudioSource.uri(
            Uri.parse(track.audioUrl),
            tag: MediaItem(
              id: track.id,
              title: track.title,
              artist: track.artistName,
              artUri: BrandAssets.mediaArtUri(track.artworkUrl),
              extras: {
                'source': 'radio',
                'radioId': expectedRadioId,
                'songId': track.id,
              },
            ),
          ),
          initialPosition: startAt > 0 ? Duration(seconds: startAt) : null,
          // Re-checked inside the load gate: rapid retunes queue several loads
          // and they don't resume in call order.
          isStale: () =>
              _stationContextLost(expectedSwitchId, expectedRadioId),
        );
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        final msg = e.toString();
        if (msg.contains('Loading interrupted') && attempt < 2) {
          await Future.delayed(Duration(milliseconds: 120 * (attempt + 1)));
          continue;
        }
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _noContent = true;
          _noContentMessage = 'Could not start playback. Tap retry.';
        });
        return;
      }
    }
    if (lastError != null) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _noContent = true;
        _noContentMessage = 'Could not start playback. Tap retry.';
      });
      return;
    }
    // Dropped inside the gate because a newer station took over — that station's
    // load owns the player now, so playing here would pull the listener back.
    if (!applied) return;
    if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;
    // A stale rate from an interrupted catch-up must not carry into the new
    // song.
    if (_audioPlayer.speed != 1.0) await _audioPlayer.setSpeed(1.0);
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
      unawaited(_radioService.reportPlay(track.id, radioId: expectedRadioId));
    }
    if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;

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
      _isFavorite = false;
    });
    _scheduleTrackBoundarySync(track);
    unawaited(_refreshTrackStats());
    unawaited(_loadSongAccess(track.id));
    unawaited(_loadFavorite(track.id));
    unawaited(_applyBoothState(track));
  }

  Future<void> _loadFavorite(String songId) async {
    if (songId.isEmpty) return;
    try {
      final favorited = await _radioService.isFavorited(songId);
      if (!mounted || _currentTrack?.id != songId) return;
      setState(() => _isFavorite = favorited);
    } catch (_) {}
  }

  Future<void> _toggleFavorite() async {
    final track = _currentTrack;
    if (track == null || _favoriteBusy) return;
    final next = !_isFavorite;
    setState(() {
      _favoriteBusy = true;
      _isFavorite = next;
    });
    try {
      if (next) {
        await _radioService.favorite(track.id);
      } else {
        await _radioService.unfavorite(track.id);
      }
      if (!mounted) return;
      setState(() => _isFavorite = next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            next
                ? '⭐ Added to Favorites. We’ll notify you when it plays.'
                : 'Removed from Favorites.',
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isFavorite = !next);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not update favorite: $e')),
      );
    } finally {
      if (mounted) setState(() => _favoriteBusy = false);
    }
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
      // The store path needs the price up front to pick the right tier SKU.
      final access = _songAccess ?? await _songs.getAccess(track.id);
      if (access == null) {
        throw Exception('Could not load the price for this song.');
      }
      final outcome = await SongPurchaseFlow.buy(
        songId: track.id,
        priceCents: access.priceCents,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(outcome.message)));
      if (outcome.unlocked) await _loadSongAccess(track.id);
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
  /// so listeners hear the admin go live / queue advance without waiting for poll.
  Future<void> _onDjBoothEvent(DjBoothRealtimeEvent event) async {
    // One handler per event: both instances subscribe to the same stream, and
    // duplicate overlay starts/syncs from the buried one just race the top one.
    if (!_isSyncDriver) return;
    final handler = AudioPlayerService.handler;
    switch (event.type) {
      case 'mic_on':
        // Prefer the WHEP (WebRTC) URL — Cloudflare produces no HLS for
        // WHIP-published DJ mics, so the HLS URL alone is unplayable.
        final url = event.streamUrl;
        if (url != null && url.isNotEmpty) {
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
      case 'queue_updated':
        // Hard live sync: jump to the server's current track as soon as the
        // shared queue advances (don't wait for the next poll tick).
        // Skip while discography/sample owns the player.
        if (!_nonRadioOwnsPlayer) {
          unawaited(_syncCurrentTrack());
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
    final overlayUrl = overlay?.streamUrl;
    if (overlay != null &&
        overlay.active &&
        overlayUrl != null &&
        overlayUrl.isNotEmpty) {
      await AudioPlayerService.handler.startVoiceOverlay(
        overlayUrl,
        duckVolume: overlay.duckVolume,
      );
    } else {
      await AudioPlayerService.handler.stopVoiceOverlay();
    }
  }


  void _markAdvancedFrom(Track? track) {
    if (track == null || track.id.isEmpty) return;
    _recentlyAdvancedFrom = (id: track.id, at: DateTime.now());
    RadioFinishedPlays.instance.markFinished(_radioId, track);
  }

  bool _isStaleServerTrack(Track? serverTrack) {
    if (serverTrack == null) return false;
    if (RadioFinishedPlays.instance.isFinishedPlay(_radioId, serverTrack)) {
      return true;
    }
    final adv = _recentlyAdvancedFrom;
    if (adv == null || adv.id != serverTrack.id) return false;
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
  /// nudge it once with a force-advance, naming the song we finished. The server
  /// only honours that nudge while the queue is still on that song, so a device
  /// arriving late can't skip a track for everyone else.
  Future<void> _handleTrackEnded() async {
    if (!mounted || _trackAdvanceInFlight || _trackSyncInFlight) return;
    // Both mounted instances hear the shared player complete; only the top one
    // may advance, or the queue gets nudged twice.
    if (!_isSyncDriver) return;
    // Tearing down the old station's source can surface as a completed track;
    // advancing here would pull the next song of the station we just left.
    if (_stationSwitchInFlight) return;
    if (_nonRadioOwnsPlayer) return;
    final switchId = _stationSwitchGeneration;
    final radioId = _radioId;
    _trackAdvanceInFlight = true;
    _trackBoundaryTimer?.cancel();
    final endedId = _currentTrack?.id;
    try {
      var res = await _radioService.getNextTrack(
        radioId: radioId,
      );
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
      if (_stationContextLost(switchId, radioId)) return;
      if (_nonRadioOwnsPlayer) return;

      // Couldn't reach the service to advance — keep the ended track on screen
      // rather than blanking the station; the monitor will resync on recovery.
      if (res.networkError) return;

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
      // file). Nudge the shared queue forward, naming the song we finished so a
      // nudge that arrives after someone else's advance is ignored.
      if (endedId != null && res.track != null && res.track!.id == endedId) {
        final forced = await _radioService.getNextTrack(
          radioId: radioId,
          force: true,
          after: endedId,
        );
        if (_stationContextLost(switchId, radioId)) return;
        if (_nonRadioOwnsPlayer) return;
        if (!forced.noContent && forced.track != null) {
          res = forced;
        }
      }

      final track = res.track;
      if (track == null || track.audioUrl.trim().isEmpty) return;
      if (_isStaleServerTrack(track)) return;
      if (_nonRadioOwnsPlayer) return;

      final previous = _currentTrack;
      if (previous != null && previous.id != track.id) {
        _markAdvancedFrom(previous);
      }

      setState(() {
        _isLoading = true;
        _noContent = false;
        _noContentMessage = null;
        _hasVoted = false;
        _selectedReaction = null;
        _isVoting = false;
      });
      await _loadAndPlay(
        track,
        res,
        reportPlay: true,
        switchId: switchId,
        radioId: radioId,
      );
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
    // Keep pace with the live queue (was 30s — too slow for station advances).
    _trackSyncTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _syncCurrentTrack();
    });
  }

  Future<void> _syncCurrentTrack({bool force = false}) async {
    if (!mounted || _trackSyncInFlight || _trackAdvanceInFlight) return;
    // A buried instance must not poll alongside the top one: with two drivers,
    // each reload the other's station and the radio flips between songs.
    if (!_isSyncDriver) return;
    // Retuning owns the player until its own load finishes.
    if (_stationSwitchInFlight) return;
    // Public profile / samples share this player — don't steal or seek them.
    if (!force && _nonRadioOwnsPlayer) return;
    final switchId = _stationSwitchGeneration;
    final radioId = _radioId;
    _trackSyncInFlight = true;
    try {
      final res = await _radioService.getCurrentTrack(radioId: radioId);
      RadioConnectionMonitor.instance.reportRequestResult(
        networkError: res.networkError,
      );
      // The listener may have retuned while we awaited: this reply describes
      // the station they just left.
      if (_stationContextLost(switchId, radioId)) return;
      // Profile may have taken over while we awaited the server.
      if (!force && _nonRadioOwnsPlayer) return;

      // A dropped request is not an empty station. Tearing down the now-playing
      // UI on a weak connection wrongly showed "Station Offline" while audio was
      // still playing — leave everything as-is and let the connection banner
      // explain it.
      if (res.networkError) return;

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

      if (_isStaleServerTrack(serverTrack)) {
        await _applyBoothState(serverTrack);
        return;
      }

      // After a non-radio takeover, local UI track can still match server id
      // while the player is on discography — always reload when forcing reclaim.
      final playerOnRadio = _hasLiveRadioSource;
      final trackChanged =
          localTrack == null || localTrack.id != serverTrack.id;

      // Our song is seconds from the end: let the boundary handler do the
      // handoff rather than tearing down a buffer we're about to finish with.
      // Requires audio to be actually flowing (`ready`) — a buffering-stalled
      // decoder never reaches the boundary handler, so it must hard-switch.
      if (trackChanged &&
          !force &&
          playerOnRadio &&
          localTrack != null &&
          shouldDeferTrackSwitchToBoundary(
            localSeconds: _audioPlayer.position.inSeconds,
            durationSeconds:
                _audioPlayer.duration?.inSeconds ?? localTrack.durationSeconds,
            isPlaying: _audioPlayer.playing &&
                _audioPlayer.processingState == ProcessingState.ready,
          )) {
        return;
      }

      if ((force && !playerOnRadio) || trackChanged) {
        if (!force && _nonRadioOwnsPlayer) return;
        // The shared player is already on the server's song — loaded by the
        // other PlayerScreen instance or the background sync — so adopt it
        // into this screen's UI instead of reloading, which would audibly
        // restart the track. This is the hand-off path when a pushed player
        // pops and the home-tab instance resumes driving.
        if (playerOnRadio && _loadedTrackId() == serverTrack.id) {
          final playId = serverTrack.playId;
          final alreadyVoted = playId != null &&
              playId.isNotEmpty &&
              playId == _lastVotedPlayId;
          setState(() {
            _currentTrack = serverTrack;
            _isPlaying = _audioPlayer.playing &&
                !AudioPlayerService.handler.userPaused;
            _isLoading = false;
            _noContent = false;
            _noContentMessage = null;
            _hasVoted = alreadyVoted;
            if (!alreadyVoted) _selectedReaction = null;
            _isVoting = false;
            _songAccess = null;
            _isFavorite = false;
          });
          _scheduleTrackBoundarySync(serverTrack);
          unawaited(_loadSongAccess(serverTrack.id));
          unawaited(_loadFavorite(serverTrack.id));
          await _applyBoothState(serverTrack);
          await _applyLiveSync(serverTrack);
          return;
        }
        // Hard live sync: always follow the server's current song, even mid-
        // song, so every device on a station hears the same track. Explicit
        // user pause is still respected inside [_loadAndPlay].
        setState(() {
          _isLoading = true;
          _noContent = false;
          _noContentMessage = null;
          _hasVoted = false;
          _selectedReaction = null;
          _isVoting = false;
        });
        _markAdvancedFrom(localTrack);
        await _loadAndPlay(
          serverTrack,
          res,
          reportPlay: _isPlaying || localTrack?.id != serverTrack.id,
          switchId: switchId,
          radioId: radioId,
        );
        return;
      }

      if (!_hasLiveRadioSource) return;

      await _applyLiveSync(serverTrack);
      setState(() {
        _currentTrack = localTrack.copyWith(
          listenerCount: serverTrack.listenerCount,
          fireVotes: serverTrack.fireVotes,
          shitVotes: serverTrack.shitVotes,
          temperaturePercent: serverTrack.temperaturePercent,
          // Keep playId current — votes need it, and same-track resume sync
          // used to leave a stale/empty playId until a station change.
          playId: serverTrack.playId ?? localTrack.playId,
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

  /// Reconcile local playback with the live timeline without glitching.
  ///
  /// A seek drops the buffer and restarts buffering, which on a weak link makes
  /// things worse and loops. [decideRadioSync] therefore prefers a small rate
  /// nudge and never seeks backwards mid-song.
  Future<void> _applyLiveSync(Track serverTrack) async {
    final decision = decideRadioSync(
      localSeconds: _audioPlayer.position.inSeconds,
      targetSeconds: liveTargetSeconds(serverTrack),
      durationSeconds:
          _audioPlayer.duration?.inSeconds ?? serverTrack.durationSeconds,
      isBuffering:
          _audioPlayer.processingState == ProcessingState.buffering,
      connectionDegraded: RadioConnectionMonitor.instance.current.isImpaired,
      currentSpeed: _audioPlayer.speed,
    );

    switch (decision.action) {
      case RadioSyncAction.none:
        return;
      case RadioSyncAction.nudge:
        await _audioPlayer.setSpeed(decision.speed);
      case RadioSyncAction.seek:
        final now = DateTime.now();
        if (now.difference(_lastSyncSeekAt).inSeconds < 30) return;
        _lastSyncSeekAt = now;
        if (_audioPlayer.speed != 1.0) await _audioPlayer.setSpeed(1.0);
        await _audioPlayer.seek(Duration(seconds: decision.targetSeconds!));
    }
  }

  void _startTrackStatsTimer() {
    _presenceTimer?.cancel();
    _presenceTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _refreshTrackStats();
    });
  }

  Future<void> _refreshTrackStats() async {
    if (!mounted || _presenceTickInFlight || !_isSyncDriver) return;
    final track = _currentTrack;
    final isTunedIn = _isPlaying || AudioPlayerService.handler.userPausedNotifier.value;
    if (!isTunedIn || track == null || track.id.isEmpty) return;

    _presenceTickInFlight = true;
    try {
      final latest = await _radioService.getCurrentTrack(radioId: _radioId);
      final latestTrack = latest.track;
      if (!mounted || latestTrack == null || latestTrack.id != track.id) return;

      setState(() {
        _currentTrack = track.copyWith(
          listenerCount: latestTrack.listenerCount,
          fireVotes: latestTrack.fireVotes,
          shitVotes: latestTrack.shitVotes,
          temperaturePercent: latestTrack.temperaturePercent,
          playId: latestTrack.playId ?? track.playId,
        );
      });
    } catch (_) {
      // Best effort only.
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
      if (result == null) {
        if (!mounted) return;
        setState(() => _isVoting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not save your vote. Check your connection and try again.'),
          ),
        );
        return;
      }
      final previousReaction =
          ((result['previousReaction'] as String?) ?? _selectedReaction);
      String? serverReaction = result['reaction'] as String?;
      if (serverReaction != 'fire' && serverReaction != 'shit') {
        // Backward-compatible fallback if backend returns the old shape.
        final alreadyVoted = result['alreadyVoted'] == true;
        if (alreadyVoted) {
          serverReaction = previousReaction;
        } else {
          serverReaction = reaction;
        }
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
                  ? '🔥 Vote locked in.'
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
    // Reclaim live radio if a profile/sample took over the shared player.
    if (_nonRadioOwnsPlayer) {
      await _syncCurrentTrack(force: true);
      if (!mounted) return;
      if (handler.userPaused) {
        await handler.setUserPaused(false);
      }
      setState(() => _isPlaying = !handler.userPaused && _audioPlayer.playing);
      return;
    }
    final shouldPlay = handler.userPaused;
    try {
      await handler.setUserPaused(!shouldPlay);
      if (!mounted) return;
      setState(() => _isPlaying = shouldPlay);
      if (shouldPlay) {
        _refreshTrackStats();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isPlaying = !handler.userPaused && _audioPlayer.playing);
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _mounted.remove(this);
    if (_mounted.isEmpty) {
      RadioBackgroundSyncService.instance.playerScreenActive = false;
      RadioBackgroundSyncService.instance.stationSwitchInFlight = false;
      _StationTuner.switchInFlight = false;
    } else {
      // The instance underneath becomes the sync driver again. It was passive
      // while buried, so catch it up right away instead of waiting out its
      // poll tick. Post-frame: never re-enter sync mid-dispose of this route.
      final next = _mounted.last;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (next.mounted) unawaited(next._syncCurrentTrack());
      });
    }
    RadioConnectionMonitor.instance.removeRestoreListener(_onConnectionRestored);
    RadioConnectionMonitor.instance.state.removeListener(
      _onConnectionStateChanged,
    );
    _playerStateSub?.cancel();
    _risingStarSub?.cancel();
    _djBoothSub?.cancel();
    _presenceTimer?.cancel();
    _trackSyncTimer?.cancel();
    _trackBoundaryTimer?.cancel();
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
          final showCoverBackdrop = !_isLoading &&
              !_noContent &&
              _currentTrack != null;
          final coverUrl = showCoverBackdrop
              ? BrandAssets.displayArtworkUrl(_currentTrack!.artworkUrl)
              : null;

          return Scaffold(
            backgroundColor: DimensionTokens.bgBase,
            extendBodyBehindAppBar: showCoverBackdrop,
            // Over artwork the bar is pure chrome — the station name is the
            // title, and tapping it opens the picker. "Change" used to appear
            // here *and* in the panel below.
            appBar: AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              centerTitle: true,
              foregroundColor:
                  showCoverBackdrop ? Colors.white : DimensionTokens.textPrimary,
              leading: widget.onOpenNavDrawer != null
                  ? IconButton(
                      icon: const Icon(Icons.menu),
                      tooltip: 'Menu',
                      onPressed: widget.onOpenNavDrawer,
                    )
                  : null,
              title: _StationTitle(
                label: _activeStation.genre,
                reconnecting: _connectionImpaired,
                onTap: _openStationPicker,
                onLight: showCoverBackdrop,
              ),
              actions: [
                if (widget.onUpload != null)
                  IconButton(
                    onPressed: widget.onUpload,
                    tooltip: 'Upload',
                    icon: const Icon(Icons.cloud_upload_outlined),
                  ),
              ],
            ),
            body: Stack(
              fit: StackFit.expand,
              children: [
                // One background: the artwork, blurred out of focus. The old
                // stack layered the cover, a blue pearl wash, an animated cyber
                // grid and three glow orbs on top of each other, which left
                // nothing on the screen actually looking like the album.
                if (coverUrl != null)
                  Positioned.fill(
                    child: FloatingAlbumScene(
                      key: ValueKey('player-bg-$coverUrl'),
                      imageUrl: coverUrl,
                      fullscreen: true,
                      blurSigma: 45,
                    ),
                  )
                else
                  const Positioned.fill(child: CyberBackdrop()),
                // A single scrim carries text contrast, densest at the bottom
                // where the small type lives. It takes the theme's colour so
                // body text stays legible in light mode too.
                if (coverUrl != null)
                  Positioned.fill(
                    child: IgnorePointer(child: _ArtworkScrim()),
                  ),
                if (_isLoading)
                  const Center(child: CircularProgressIndicator())
                else if (_noContent)
                  _NoContent(
                    message: _noContentMessage,
                    onRetry: _loadInitialTrack,
                    onChangeStation: _openStationPicker,
                  )
                else if (_currentTrack == null)
                  const Center(child: Text('No track playing'))
                else
                  Padding(
                    // Body draws under the transparent app bar when cover is on.
                    padding: EdgeInsets.only(
                      top: showCoverBackdrop
                          ? MediaQuery.paddingOf(context).top + kToolbarHeight
                          : 0,
                    ),
                    child: _PlayerBody(
                      track: _currentTrack!,
                      radioId: _radioId,
                      stationLabel: _activeStation.genre,
                      onChangeStation: _openStationPicker,
                      risingStarText: _risingStarText,
                      ad: _ad,
                      isPlaying: _isPlaying,
                      hasVoted: _hasVoted,
                      isVoting: _isVoting,
                      selectedReaction: _selectedReaction,
                      isFavorite: _isFavorite,
                      favoriteBusy: _favoriteBusy,
                      canVote: (_currentTrack?.playId ?? '').isNotEmpty,
                      fireVotes: _currentTrack?.fireVotes ?? 0,
                      shitVotes: _currentTrack?.shitVotes ?? 0,
                      temperaturePercent:
                          _currentTrack?.temperaturePercent ?? 0,
                      songAccess: _songAccess,
                      isBuying: _isBuying,
                      onBuy: _buySong,
                      onReact: _react,
                      onToggleFavorite: _toggleFavorite,
                      onAddToPlaylist: () {
                        final t = _currentTrack;
                        if (t == null) return;
                        unawaited(
                          AddToPlaylistSheet.show(
                            providerContext,
                            songId: t.id,
                            songTitle: t.title,
                          ),
                        );
                      },
                      onPlayPause: _togglePlayPause,
                      onEnterRoom: () => _openRoom(providerContext),
                      audioPlayer: _audioPlayer,
                    ),
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

/// A secondary control beside the play button — plain glyph, generous tap area.
class _PlayerAction extends StatelessWidget {
  const _PlayerAction({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.color,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      iconSize: 26,
      color: color ?? DimensionTokens.textSecondary,
      icon: Icon(icon),
    );
  }
}

/// Reactions, crowd temperature and add-to-playlist as one quiet strip.
///
/// These were previously a bordered "Song temperature" card with its own
/// progress bar and emoji tallies, plus two more emoji buttons in the transport
/// row — the same information competing with itself in two places.
class _ReactionStrip extends StatelessWidget {
  const _ReactionStrip({
    required this.canVote,
    required this.isVoting,
    required this.selectedReaction,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.onReact,
    required this.onAddToPlaylist,
  });

  final bool canVote;
  final bool isVoting;
  final String? selectedReaction;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final void Function(String reaction) onReact;
  final VoidCallback onAddToPlaylist;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final scheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _ReactionChip(
              emoji: '🔥',
              count: fireVotes,
              selected: selectedReaction == 'fire',
              enabled: canVote && !isVoting,
              onTap: () => onReact('fire'),
            ),
            const SizedBox(width: 10),
            _ReactionChip(
              emoji: '💩',
              count: shitVotes,
              selected: selectedReaction == 'shit',
              enabled: canVote && !isVoting,
              onTap: () => onReact('shit'),
            ),
            const SizedBox(width: 10),
            _PlayerAction(
              icon: Icons.playlist_add_rounded,
              tooltip: 'Add to playlist',
              onPressed: onAddToPlaylist,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 120,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  minHeight: 3,
                  value: temperaturePercent.clamp(0, 100) / 100,
                  backgroundColor:
                      DimensionTokens.textPrimary.withValues(alpha: 0.14),
                  valueColor: AlwaysStoppedAnimation(scheme.primary),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$temperaturePercent% hot',
              style: TextStyle(
                fontSize: 12,
                color: DimensionTokens.textSecondary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ReactionChip extends StatelessWidget {
  const _ReactionChip({
    required this.emoji,
    required this.count,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String emoji;
  final int count;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: selected
          ? scheme.primary.withValues(alpha: 0.16)
          : DimensionTokens.textPrimary.withValues(alpha: 0.08),
      shape: StadiumBorder(
        side: BorderSide(
          color: selected ? scheme.primary : Colors.transparent,
        ),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 15)),
              const SizedBox(width: 6),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: DimensionTokens.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Contrast wash over the blurred cover behind the player.
class _ArtworkScrim extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final base = DimensionTokens.isDark ? Colors.black : Colors.white;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            base.withValues(alpha: 0.55),
            base.withValues(alpha: 0.38),
            base.withValues(alpha: 0.86),
          ],
          stops: const [0.0, 0.32, 1.0],
        ),
      ),
    );
  }
}

/// App bar title: the station you're on, tappable to switch. Doubles as the
/// connection indicator so "RECONNECTING" doesn't need its own badge.
class _StationTitle extends StatelessWidget {
  const _StationTitle({
    required this.label,
    required this.reconnecting,
    required this.onTap,
    required this.onLight,
  });

  final String label;
  final bool reconnecting;
  final VoidCallback onTap;

  /// True when drawn over artwork, where everything must read as white.
  final bool onLight;

  @override
  Widget build(BuildContext context) {
    final color = onLight ? Colors.white : DimensionTokens.textPrimary;
    final subColor = onLight
        ? Colors.white.withValues(alpha: 0.7)
        : DimensionTokens.textSecondary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              reconnecting ? 'Reconnecting' : 'Live radio',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.2,
                color: reconnecting ? DimensionTokens.neonYellow : subColor,
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(width: 2),
                Icon(Icons.expand_more_rounded, size: 18, color: subColor),
              ],
            ),
          ],
        ),
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
      child: GlassCard(
        padding: const EdgeInsets.all(18),
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('📻', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              Text(
                'Station Offline',
                style: DimensionTypography.cardTitle(fontSize: 18),
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
  final String radioId;
  final String stationLabel;
  final VoidCallback onChangeStation;
  final String? risingStarText;
  final VenueAd? ad;
  final bool isPlaying;
  final bool hasVoted;
  final bool isVoting;
  final String? selectedReaction;
  final bool isFavorite;
  final bool favoriteBusy;
  final bool canVote;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final SongAccess? songAccess;
  final bool isBuying;
  final VoidCallback onBuy;
  final Future<void> Function(String reaction) onReact;
  final VoidCallback onToggleFavorite;
  final VoidCallback onAddToPlaylist;
  final VoidCallback onPlayPause;
  final VoidCallback onEnterRoom;
  final AudioPlayer audioPlayer;

  const _PlayerBody({
    required this.track,
    required this.radioId,
    required this.stationLabel,
    required this.onChangeStation,
    required this.risingStarText,
    required this.ad,
    required this.isPlaying,
    required this.hasVoted,
    required this.isVoting,
    required this.selectedReaction,
    required this.isFavorite,
    required this.favoriteBusy,
    required this.canVote,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.songAccess,
    required this.isBuying,
    required this.onBuy,
    required this.onReact,
    required this.onToggleFavorite,
    required this.onAddToPlaylist,
    required this.onPlayPause,
    required this.onEnterRoom,
    required this.audioPlayer,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget albumArt() {
      final artworkUrl = BrandAssets.displayArtworkUrl(track.artworkUrl);
      return AspectRatio(
        aspectRatio: 1,
        child: DecoratedBox(
          // The one place in the app that gets a real drop shadow — it lifts
          // the cover off its own blurred backdrop.
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            boxShadow: DimensionTokens.artworkShadow(blur: 36),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (artworkUrl != null)
                  FloatingAlbumScene(
                    key: ValueKey(artworkUrl),
                    imageUrl: artworkUrl,
                    floatAmplitude: 0,
                    borderRadius: BorderRadius.zero,
                  )
                else
                  ColoredBox(
                    color: DimensionTokens.bgSurface,
                    child: Icon(
                      Icons.radio_rounded,
                      size: 64,
                      color: DimensionTokens.textMuted,
                    ),
                  ),
                if (track.isLiveBroadcast)
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: scheme.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Live',
                        style: TextStyle(
                          color: scheme.onPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    // No panel. Track details sit directly on the scrimmed artwork, the way a
    // now-playing screen should — a translucent card floating over a blurred
    // copy of the same image was two layers of frosting on one cake.
    Widget glassPanel({required Widget child, double padding = 16}) {
      return Padding(
        padding: EdgeInsets.symmetric(horizontal: padding * 0.25),
        child: child,
      );
    }

    Widget buyAction() {
      final access = songAccess;
      if (access?.owned == true) {
        final label = access!.isOwner ? 'Your upload' : 'Owned · in your library';
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
                label,
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
        final isTablet = constraints.maxWidth >= DimensionTokens.breakpointTablet;
        final isWide = constraints.maxWidth >= DimensionTokens.breakpointWide;
        final isDesktop = constraints.maxWidth >= DimensionTokens.breakpointDesktop;
        final isShortScreen =
            constraints.maxHeight < 760 && !isDesktop;
        final panelPadding = isShortScreen ? 12.0 : (isTablet ? 20.0 : 16.0);
        final sectionGap = isShortScreen ? 8.0 : (isTablet ? 14.0 : 12.0);
        final titleGap = isShortScreen ? 4.0 : 6.0;
        final metaGap = isShortScreen ? 6.0 : 8.0;
        final beforeProgressGap = isShortScreen ? 10.0 : (isTablet ? 18.0 : 14.0);
        final afterProgressGap = isShortScreen ? 8.0 : (isTablet ? 14.0 : 10.0);
        final outerPadding = isShortScreen ? 12.0 : (isTablet ? 24.0 : 16.0);
        final controlsIconSize = isShortScreen
            ? 48.0
            : (isTablet ? 64.0 : 52.0);
        final wideArtWidth = isDesktop
            ? 400.0
            : isWide
                ? 360.0
                : 320.0;
        final compactTargetHeight =
            constraints.maxHeight * (ad != null ? 0.30 : 0.38);
        final compactArtSize = math.min(
          constraints.maxWidth,
          compactTargetHeight.clamp(180.0, isTablet ? 380.0 : 340.0).toDouble(),
        );
        final art = SizedBox(
          width: isWide ? wideArtWidth : compactArtSize,
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
                style: DimensionTypography.cardTitle(fontSize: 18),
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
                    '${AnalyticsMetrics.liveListeners.label}: ${isPlaying && track.listenerCount < 1 ? 1 : track.listenerCount}',
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
              // Transport comes first now, and it is one big centered play
              // control flanked by the two most-used actions. It used to be
              // seven targets — play, chat, two emoji vote buttons, favourite,
              // playlist — jammed into a single row.
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _PlayerAction(
                    icon: Icons.forum_outlined,
                    tooltip: 'The Room',
                    onPressed: onEnterRoom,
                  ),
                  SizedBox(width: isShortScreen ? 28 : 40),
                  IconButton(
                    onPressed: onPlayPause,
                    iconSize: controlsIconSize,
                    padding: EdgeInsets.zero,
                    color: scheme.onSurface,
                    tooltip: isPlaying ? 'Pause' : 'Play',
                    icon: Icon(
                      isPlaying
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                    ),
                  ),
                  SizedBox(width: isShortScreen ? 28 : 40),
                  _PlayerAction(
                    icon: isFavorite ? Icons.star : Icons.star_border,
                    tooltip: isFavorite
                        ? 'Remove from Favorites'
                        : 'Add to Favorites',
                    color: isFavorite ? scheme.primary : null,
                    onPressed: favoriteBusy ? null : onToggleFavorite,
                  ),
                ],
              ),
              SizedBox(height: afterProgressGap),
              _ReactionStrip(
                canVote: canVote,
                isVoting: isVoting,
                selectedReaction: selectedReaction,
                fireVotes: fireVotes,
                shitVotes: shitVotes,
                temperaturePercent: temperaturePercent,
                onReact: onReact,
                onAddToPlaylist: onAddToPlaylist,
              ),
              SizedBox(height: afterProgressGap),
              buyAction(),
              SizedBox(height: afterProgressGap),
              SyncedLyricsPanel(
                songId: track.id,
                positionStream: audioPlayer.positionStream,
                currentPosition: () => audioPlayer.position,
              ),
              SizedBox(height: afterProgressGap),
              RadioUpNextQueue(
                radioId: radioId,
                currentId: track.id,
                compact: true,
              ),
            ],
          ),
        );

        return Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: isWide
                  ? DimensionTokens.maxContentWidth
                  : double.infinity,
            ),
            child: SingleChildScrollView(
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
            ),
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
                          ? 'National'
                          : count > 0
                              ? '$count song${count != 1 ? 's' : ''}'
                              : 'No songs yet',
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
