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
import '../../core/auth/require_account.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/models/track.dart';
import '../../core/models/track_fetch_result.dart';
import '../../core/radio/radio_sync.dart';
import '../../core/radio/station_catalog.dart';
import '../../core/services/api_service.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/growth_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/song_purchase_flow.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/chat_service.dart';
import '../../core/services/venue_ads_service.dart';
import '../../core/services/radio_background_sync_service.dart';
import '../../core/services/radio_connection_monitor.dart';
import '../../core/services/radio_presence_service.dart';
import '../../core/services/radio_share.dart';
import 'radio_capture_screen.dart';
import 'widgets/album_reaction_fx.dart';
import 'widgets/song_stories_strip.dart';
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
import 'widgets/butterfly_swarm_backdrop.dart';
import 'widgets/frequency_visualizer.dart';
import '../../core/ui/app_haptics.dart';
import 'widgets/radio_up_next_queue.dart';
import 'widgets/chat_panel.dart';
import 'widgets/synced_lyrics_panel.dart';
import '../pro_radio/widgets/add_to_playlist_sheet.dart';
import '../../widgets/player/song_rating_sheet.dart';
import '../../widgets/safety/song_report_sheet.dart';

part 'widgets/player_chrome.dart';

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
  const PlayerScreen({
    super.key,
    this.onOpenNavDrawer,
    this.onUpload,
    this.bottomOverlay = 0,
    this.onSheetDragUpdate,
    this.onSheetDragEnd,
  });

  /// Opens the app's left navigation drawer (shown as a hamburger in the bar).
  final VoidCallback? onOpenNavDrawer;

  /// Space taken by a glass tab bar drawn over the bottom of this screen.
  final double bottomOverlay;

  /// Home shell owns the radio sheet. A downward drag reports finger travel
  /// here so the shell can slide the player away. When unset, the player pops
  /// its own route.
  final void Function(double dy)? onSheetDragUpdate;
  final void Function(double velocity)? onSheetDragEnd;

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
  bool get _isSyncDriver =>
      _mounted.isNotEmpty && identical(_mounted.last, this);

  final AudioPlayer _audioPlayer = AudioPlayerService().player;
  final ScrollController _playerScroll = ScrollController();
  final ValueNotifier<Offset> _coverTilt = ValueNotifier(Offset.zero);
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
  int _albumBurstSerial = 0;
  String? _albumBurstKind;
  bool _isVoting = false;
  bool _isFavorite = false;
  bool _favoriteBusy = false;
  int? _listenerRating;
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
  Timer? _prefetchTimer;
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
  late final ValueNotifier<({String? id, String? title, String? artist})>
      _roomSong;

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

  StationOption get _activeStation {
    for (final station in kStationCatalog) {
      if (station.id == _radioId) return station;
    }
    return const StationOption(
      id: 'us-ready-now-rap',
      genre: 'Ready Now Radio',
    );
  }

  @override
  void initState() {
    super.initState();
    _mounted.add(this);
    RadioBackgroundSyncService.instance.playerScreenActive = true;
    RadioBackgroundSyncService.instance.onCarTune = _tuneFromCar;
    WidgetsBinding.instance.addObserver(this);
    _rippleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    );
    _roomSong = ValueNotifier((
      id: null,
      title: null,
      artist: null,
    ));
    _loadMe();
    final seeded = _trackFromLiveRadio();
    if (seeded != null) {
      _currentTrack = seeded;
      _isLoading = false;
      _isPlaying =
          _audioPlayer.playing && !AudioPlayerService.handler.userPaused;
    }
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
    RadioConnectionMonitor.instance.state.addListener(
      _onConnectionStateChanged,
    );
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
      // The station is already audible. Paint that track and refresh votes,
      // ads, and sync behind it — never replace it with a spinner or a second
      // load of the same source.
      if (_hasLiveRadioSource) {
        setState(() {
          _ad = ad;
          _isLoading = false;
          _noContent = false;
          _currentTrack ??= _trackFromLiveRadio();
          _isPlaying =
              _audioPlayer.playing && !AudioPlayerService.handler.userPaused;
        });
        unawaited(_syncCurrentTrack());
        return;
      }
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

  /// What the shared player is already playing, so the first frame of this
  /// screen can show artwork, title, and transport before the network sync.
  Track? _trackFromLiveRadio() {
    final source = _audioPlayer.sequenceState.currentSource;
    final tag = source?.tag;
    if (tag is! MediaItem || tag.extras?['source'] != 'radio') return null;
    final extras = tag.extras ?? const <String, dynamic>{};
    final uri = source is UriAudioSource ? source.uri.toString() : '';
    final duration = _audioPlayer.duration?.inSeconds ?? 0;
    final artist = tag.artist?.trim();
    return Track(
      id: (extras['songId'] ?? tag.id).toString(),
      title: tag.title.trim().isEmpty ? 'NETWORX Radio' : tag.title,
      artistName: artist == null || artist.isEmpty ? 'NETWORX Radio' : artist,
      artistId: extras['artistId']?.toString(),
      audioUrl: uri,
      artworkUrl: tag.artUri?.toString(),
      durationSeconds: duration < 0 ? 0 : duration,
      playId: extras['playId']?.toString(),
      positionSeconds: _audioPlayer.position.inSeconds,
    );
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

  /// A second mounted instance (mini bar, notification, Pro-Radio) adopts the
  /// station already live. A cold open uses the last station the listener
  /// tuned, and Ready Now only when nothing has been saved yet.
  Future<void> _restoreStationSelection() async {
    final live = _StationTuner.radioId ?? _liveSourceRadioId();
    if (live != null && live.isNotEmpty) {
      _radioId = live;
      await _persistStationSelection(live);
      return;
    }
    var stationId = env('RADIO_STATION_ID') ?? 'us-ready-now-rap';
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_selectedStationPrefKey)?.trim();
      if (stored != null && stored.isNotEmpty) stationId = stored;
    } catch (_) {
      // Keep the fallback if storage is unavailable.
    }
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

  static Future<void> _tuneFromCar(String stationId) async {
    final driver = _mounted.isNotEmpty ? _mounted.last : null;
    if (driver == null || !driver.mounted) return;
    final station = stationById(stationId);
    if (station == null) return;
    if (station.id == driver._radioId) {
      await AudioPlayerService.handler.setUserPaused(false);
      return;
    }
    await driver._changeStation(station);
  }

  void _announceTunedTo(StationOption station) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('Tuned to ${station.genre}')));
  }

  Future<void> _changeStation(StationOption station) async {
    if (station.id == _radioId) return;
    final switchId = _nextStationSwitchGeneration();
    _stationSwitchInFlight = true;
    _trackBoundaryTimer?.cancel();
    _prefetchTimer?.cancel();
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

      await _loadAndPlay(track, res, switchId: switchId, radioId: station.id);
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
    final selected = await showModalBottomSheet<StationOption>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) =>
          _StationPickerSheet(currentId: _radioId, api: ApiService()),
    );
    if (selected != null) {
      await _changeStation(selected);
    }
  }

  Future<void> _cycleStation(int direction) async {
    if (kStationCatalog.isEmpty) return;
    final index = kStationCatalog.indexWhere((s) => s.id == _radioId);
    final current = index < 0 ? 0 : index;
    final next = (current + direction) % kStationCatalog.length;
    final wrapped = next < 0 ? kStationCatalog.length - 1 : next;
    AppHaptics.selection();
    await _changeStation(kStationCatalog[wrapped]);
  }

  Future<void> _loadInitialTrack() async {
    setState(() {
      _isLoading = true;
      _noContent = false;
      _noContentMessage = null;
    });

    try {
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
    } catch (e) {
      // just_audio can throw from play()/setVolume() when a load races an
      // interruption; without this the screen keeps spinning forever.
      debugPrint('Initial track load failed: $e');
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _noContent = true;
        _noContentMessage = 'Could not start the radio. Tap retry.';
      });
    }
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
    if (AudioPlayerService.handler.holdsExternalAudio) return;

    final audio = AudioPlayerService();
    Object? lastError;
    var applied = false;
    // Start where the song is *now*. On a slow link the server's snapshot is
    // already seconds old by the time it reaches us.
    final startAt = liveTargetSeconds(track);
    for (var attempt = 0; attempt < 3; attempt++) {
      if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;
      if (AudioPlayerService.handler.holdsExternalAudio) return;
      try {
        applied = await audio.loadSource(
          AudioSource.uri(
            Uri.parse(track.audioUrl),
            tag: MediaItem(
              id: track.id,
              title: track.title,
              artist: track.artistName,
              album: stationLabel(expectedRadioId),
              artUri: BrandAssets.mediaArtUri(track.artworkUrl),
              extras: {
                'source': 'radio',
                'radioId': expectedRadioId,
                'songId': track.id,
                if (track.playId != null && track.playId!.isNotEmpty)
                  'playId': track.playId,
                if (track.artistId != null && track.artistId!.isNotEmpty)
                  'artistId': track.artistId,
              },
            ),
          ),
          initialPosition: startAt > 0 ? Duration(seconds: startAt) : null,
          // Re-checked inside the load gate: rapid retunes queue several loads
          // and they don't resume in call order.
          isStale: () => _stationContextLost(expectedSwitchId, expectedRadioId),
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
    if (AudioPlayerService.handler.radioMutedByUser) {
      await AudioPlayerService.handler.setUserPaused(true);
    }
    if (AudioPlayerService.handler.holdsExternalAudio) {
      // A clip or video owns the microphone. Starting the station here, even
      // at volume 0, steals the audio unit and the recording cannot finish.
      try {
        await _audioPlayer.pause();
      } catch (_) {}
    } else if (AudioPlayerService.handler.userPaused) {
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
      unawaited(
        GrowthService().recordListen(
          songId: track.id,
          title: track.title,
          artistName: track.artistName,
          artworkUrl: track.artworkUrl,
        ),
      );
    }
    if (_stationContextLost(expectedSwitchId, expectedRadioId)) return;

    final playId = track.playId;
    final alreadyVoted =
        playId != null && playId.isNotEmpty && playId == _lastVotedPlayId;

    setState(() {
      _currentTrack = track;
      _isPlaying = !AudioPlayerService.handler.userPaused;
      _isLoading = false;
      _hasVoted = alreadyVoted;
      if (!alreadyVoted) {
        _selectedReaction = null;
      }
      _songAccess = null;
      _isFavorite = false;
      _listenerRating = null;
    });
    _scheduleTrackBoundarySync(track);
    unawaited(_refreshTrackStats());
    unawaited(_loadSongAccess(track.id));
    unawaited(_loadFavorite(track.id));
    unawaited(_loadListenerRating(track.id));
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

  Future<void> _loadListenerRating(String songId) async {
    if (songId.isEmpty || _me == null) return;
    try {
      final rating = await _songs.getRating(songId);
      if (!mounted || _currentTrack?.id != songId) return;
      setState(() => _listenerRating = rating);
    } catch (_) {}
  }

  Future<void> _toggleFavorite() async {
    if (!await requireAccount(context)) return;
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not update favorite: $e')));
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Log in to buy songs.')));
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
      if (!_audioPlayer.playing &&
          _currentTrack != null &&
          !AudioPlayerService.handler.holdsExternalAudio) {
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
    final duration = _audioPlayer.duration?.inSeconds ?? track.durationSeconds;
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
    _prefetchTimer?.cancel();
    final endedId = _currentTrack?.id;
    try {
      var res = await _radioService.getNextTrack(radioId: radioId);
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
    _prefetchTimer?.cancel();
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
    final leadMs = (safeMs - 8000).clamp(0, safeMs);
    if (leadMs > 0) {
      _prefetchTimer = Timer(Duration(milliseconds: leadMs), () {
        if (!mounted || !_isSyncDriver) return;
        unawaited(_radioService.peekNextTrack(radioId: _radioId));
      });
    }
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
    _trackSyncTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      _syncCurrentTrack();
    });
  }

  Future<void> _syncCurrentTrack({bool force = false}) async {
    if (!mounted || _trackSyncInFlight || _trackAdvanceInFlight) return;
    // Reloading or seeking the station while a camera is recording makes the
    // take fail ("Could not finish that clip").
    if (AudioPlayerService.handler.holdsExternalAudio) return;
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
            isPlaying:
                _audioPlayer.playing &&
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
          final alreadyVoted =
              playId != null && playId.isNotEmpty && playId == _lastVotedPlayId;
          final keepReaction =
              _currentTrack?.id == serverTrack.id && _selectedReaction != null;
          setState(() {
            _currentTrack = serverTrack;
            _isPlaying =
                _audioPlayer.playing && !AudioPlayerService.handler.userPaused;
            _isLoading = false;
            _noContent = false;
            _noContentMessage = null;
            _hasVoted = alreadyVoted || keepReaction;
            if (!alreadyVoted && !keepReaction) _selectedReaction = null;
            _isVoting = false;
            _songAccess = null;
            _isFavorite = false;
            _listenerRating = null;
          });
          _scheduleTrackBoundarySync(serverTrack);
          unawaited(_loadSongAccess(serverTrack.id));
          unawaited(_loadFavorite(serverTrack.id));
          unawaited(_loadListenerRating(serverTrack.id));
          await _applyBoothState(serverTrack);
          await _applyLiveSync(serverTrack);
          return;
        }
        // Hard live sync: always follow the server's current song, even mid-
        // song, so every device on a station hears the same track. Explicit
        // user pause is still respected inside [_loadAndPlay].
        setState(() {
          // A station that's already playing keeps its artwork on screen while
          // a newer song loads. The spinner is only for a player with nothing
          // to show yet.
          if (!playerOnRadio || _currentTrack == null) {
            _isLoading = true;
          }
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
    if (AudioPlayerService.handler.holdsExternalAudio) return;
    final decision = decideRadioSync(
      localSeconds: _audioPlayer.position.inSeconds,
      targetSeconds: liveTargetSeconds(serverTrack),
      durationSeconds:
          _audioPlayer.duration?.inSeconds ?? serverTrack.durationSeconds,
      isBuffering: _audioPlayer.processingState == ProcessingState.buffering,
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
    _presenceTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _refreshTrackStats();
    });
  }

  Future<void> _refreshTrackStats({bool force = false}) async {
    if (!mounted || _presenceTickInFlight) return;
    if (!force && !_isSyncDriver) return;
    final track = _currentTrack;
    final isTunedIn =
        _isPlaying || AudioPlayerService.handler.userPausedNotifier.value;
    if (track == null || track.id.isEmpty) return;
    if (!force && !isTunedIn) return;

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
          popularTemperature: latestTrack.popularTemperature,
          peerTemperature: latestTrack.peerTemperature,
          popularRating: latestTrack.popularRating,
          peerRating: latestTrack.peerRating,
          playId: latestTrack.playId ?? track.playId,
        );
      });
    } catch (_) {
      // Best effort only.
    } finally {
      _presenceTickInFlight = false;
    }
  }

  Future<void> _rateCurrentSong() async {
    final track = _currentTrack;
    if (track == null) return;
    if (_me == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Log in to rate songs.')));
      return;
    }
    final rating = await SongRatingSheet.show(
      context,
      songId: track.id,
      songTitle: track.title,
      initialRating: _listenerRating,
    );
    if (!mounted || rating == null || _currentTrack?.id != track.id) return;
    setState(() => _listenerRating = rating);
    unawaited(_refreshTrackStats(force: true));
  }

  Future<void> _reportCurrentSong() async {
    final track = _currentTrack;
    final artistId = track?.artistId?.trim() ?? '';
    if (track == null || artistId.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reporting is unavailable for this track.'),
        ),
      );
      return;
    }
    if (_me == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Log in to report songs.')));
      return;
    }
    if (_me!.id == artistId) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You cannot report your own song.')),
      );
      return;
    }
    await SongReportSheet.show(
      context,
      artistId: artistId,
      songId: track.id,
      songTitle: track.title,
      artistName: track.artistName,
    );
  }

  void _onPlayerMoreSelected(String value) {
    switch (value) {
      case 'rate':
        unawaited(_rateCurrentSong());
        break;
      case 'report':
        unawaited(_reportCurrentSong());
        break;
      case 'upload':
        widget.onUpload?.call();
        break;
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

    setState(() {
      _isVoting = true;
      _albumBurstSerial += 1;
      _albumBurstKind = reaction;
    });

    // The live play id arrives a moment after the song itself. A missing id
    // used to disable the emoji so the tap did nothing, while Rate still opened.
    var playId = track.playId;
    if (playId == null || playId.isEmpty) {
      try {
        final latest = await _radioService.getCurrentTrack(radioId: _radioId);
        final latestTrack = latest.track;
        if (latestTrack != null && latestTrack.id == track.id) {
          final resolved = latestTrack.playId?.trim();
          if (resolved != null && resolved.isNotEmpty) {
            playId = resolved;
            if (mounted) {
              setState(() {
                _currentTrack = (_currentTrack ?? track).copyWith(
                  playId: resolved,
                );
              });
            }
          }
        }
      } catch (_) {
        // Vote against the song if the play id is still unknown.
      }
    }

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
            content: Text(
              'Could not save your vote. Check your connection and try again.',
            ),
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
      final temperaturePercent = (_kTempBaseline + fireVotes - shitVotes)
          .clamp(0, 100)
          .toInt();

      if (!mounted) return;
      setState(() {
        _currentTrack = track.copyWith(
          fireVotes: fireVotes,
          shitVotes: shitVotes,
          temperaturePercent: temperaturePercent,
          playId: (playId != null && playId.isNotEmpty) ? playId : track.playId,
        );
        _hasVoted = serverReaction != null;
        _selectedReaction = serverReaction;
        _lastVotedPlayId = serverReaction != null ? playId : null;
        _isVoting = false;
      });

      // Replace the local estimate with the server's numbers right away.
      unawaited(_refreshTrackStats(force: true));

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
      if (handler.userPaused && !handler.radioMutedByUser) {
        await handler.setUserPaused(false);
      }
      setState(() => _isPlaying = !handler.userPaused && _audioPlayer.playing);
      return;
    }
    final shouldPlay = handler.userPaused;
    try {
      await handler.setUserPaused(!shouldPlay, fromUser: true);
      if (!mounted) return;
      setState(() => _isPlaying = shouldPlay);
      if (shouldPlay) {
        _refreshTrackStats();
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _isPlaying = !handler.userPaused && _audioPlayer.playing,
        );
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _mounted.remove(this);
    if (_mounted.isEmpty) {
      RadioBackgroundSyncService.instance.playerScreenActive = false;
      RadioBackgroundSyncService.instance.onCarTune = null;
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
    RadioConnectionMonitor.instance.removeRestoreListener(
      _onConnectionRestored,
    );
    RadioConnectionMonitor.instance.state.removeListener(
      _onConnectionStateChanged,
    );
    _playerStateSub?.cancel();
    _risingStarSub?.cancel();
    _djBoothSub?.cancel();
    _presenceTimer?.cancel();
    _trackSyncTimer?.cancel();
    _trackBoundaryTimer?.cancel();
    _prefetchTimer?.cancel();
    _rippleController.dispose();
    _playerScroll.dispose();
    _roomSong.dispose();
    _coverTilt.dispose();
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
      backgroundColor: Colors.transparent,
      builder: (context) {
        return ChangeNotifierProvider.value(
          value: chatService,
          child: SafeArea(
            child: SizedBox(
              height: MediaQuery.of(context).size.height * 0.78,
              child: ValueListenableBuilder<
                  ({String? id, String? title, String? artist})>(
                valueListenable: _roomSong,
                builder: (context, song, _) {
                  return ChatPanel(
                    currentSongId: song.id,
                    currentSongTitle: song.title,
                    currentSongArtist: song.artist,
                    currentRadioId: _radioId,
                    showThreadToggle: true,
                    isExpanded: true,
                    fillHeightWhenExpanded: true,
                    expandedHeight: 9999,
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final nextSong = (
      id: _currentTrack?.id,
      title: _currentTrack?.title,
      artist: _currentTrack?.artistName,
    );
    if (_roomSong.value != nextSong) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final latest = (
          id: _currentTrack?.id,
          title: _currentTrack?.title,
          artist: _currentTrack?.artistName,
        );
        if (_roomSong.value != latest) _roomSong.value = latest;
      });
    }
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(radioId: _radioId),
      child: Builder(
        builder: (providerContext) {
          final showCoverBackdrop =
              !_isLoading && !_noContent && _currentTrack != null;
          final coverUrl = showCoverBackdrop
              ? BrandAssets.displayArtworkUrl(_currentTrack!.artworkUrl)
              : null;

          return _PullToClose(
            scrollController: _playerScroll,
            onDragUpdate: widget.onSheetDragUpdate,
            onDragEnd: widget.onSheetDragEnd,
            child: Scaffold(
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
              foregroundColor: showCoverBackdrop
                  ? Colors.white
                  : DimensionTokens.textPrimary,
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
                PopupMenuButton<String>(
                  tooltip: 'More',
                  icon: const Icon(Icons.more_vert),
                  onSelected: _onPlayerMoreSelected,
                  itemBuilder: (context) {
                    final track = _currentTrack;
                    final artistId = track?.artistId?.trim() ?? '';
                    final canReport =
                        track != null &&
                        artistId.isNotEmpty &&
                        (_me == null || _me!.id != artistId);
                    return [
                      const PopupMenuItem(
                        value: 'rate',
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(Icons.star_rate_rounded),
                          title: Text('Rate song (1–10)'),
                        ),
                      ),
                      if (canReport)
                        const PopupMenuItem(
                          value: 'report',
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.flag_outlined),
                            title: Text('Report'),
                          ),
                        ),
                      if (widget.onUpload != null)
                        const PopupMenuItem(
                          value: 'upload',
                          child: ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(Icons.cloud_upload_outlined),
                            title: Text('Upload'),
                          ),
                        ),
                    ];
                  },
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
                      blurSigma: 8,
                      tilt: _coverTilt,
                    ),
                  )
                else if (showCoverBackdrop)
                  const Positioned.fill(
                    child: IgnorePointer(
                      child: ButterflySwarmBackdrop(butterflyCount: 22),
                    ),
                  )
                else
                  const Positioned.fill(child: CyberBackdrop()),
                // A single scrim carries text contrast, densest at the bottom
                // where the small type lives. It takes the theme's colour so
                // body text stays legible in light mode too.
                if (coverUrl != null)
                  Positioned.fill(child: IgnorePointer(child: _ArtworkScrim())),
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
                      onCycleStation: _cycleStation,
                      risingStarText: _risingStarText,
                      ad: _ad,
                      isPlaying: _isPlaying,
                      hasVoted: _hasVoted,
                      isVoting: _isVoting,
                      selectedReaction: _selectedReaction,
                      isFavorite: _isFavorite,
                      favoriteBusy: _favoriteBusy,
                      listenerRating: _listenerRating,
                      canVote: true,
                      fireVotes: _currentTrack?.fireVotes ?? 0,
                      shitVotes: _currentTrack?.shitVotes ?? 0,
                      temperaturePercent:
                          _currentTrack?.temperaturePercent ?? 0,
                      songAccess: _songAccess,
                      isBuying: _isBuying,
                      onBuy: _buySong,
                      onReact: _react,
                      albumBurst: _albumBurstKind == null
                          ? null
                          : AlbumReactionBurst(
                              id: _albumBurstSerial,
                              kind: _albumBurstKind!,
                            ),
                      onRate: _rateCurrentSong,
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
                      scrollController: _playerScroll,
                      bottomOverlay: widget.bottomOverlay,
                      audioPlayer: _audioPlayer,
                      coverTilt: _coverTilt,
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
          ),
          );
        },
      ),
    );
  }
}

/// Closes the radio player on a downward swipe.
///
/// The song page scrolls, so a plain parent drag never wins that gesture.
/// This watches the finger directly and only takes a downward swipe while the
/// page is already at the top. A lyrics list that is itself scrolling keeps
/// the swipe.
class _PullToClose extends StatefulWidget {
  const _PullToClose({
    required this.scrollController,
    required this.child,
    this.onDragUpdate,
    this.onDragEnd,
  });

  final ScrollController scrollController;
  final Widget child;
  final void Function(double dy)? onDragUpdate;
  final void Function(double velocity)? onDragEnd;

  @override
  State<_PullToClose> createState() => _PullToCloseState();
}

class _PullToCloseState extends State<_PullToClose>
    with SingleTickerProviderStateMixin {
  late final AnimationController _snap;
  int? _pointer;
  bool _active = false;
  bool _ignore = false;
  bool _nested = false;
  double _totalDx = 0;
  double _totalDy = 0;
  double _velocity = 0;
  Duration _lastStamp = Duration.zero;
  double _offset = 0;

  @override
  void initState() {
    super.initState();
    _snap = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
  }

  @override
  void dispose() {
    _snap.dispose();
    super.dispose();
  }

  bool get _scrolledAway {
    final scroll = widget.scrollController;
    return scroll.hasClients && scroll.offset > 1;
  }

  void _resetPointer() {
    _pointer = null;
    _active = false;
    _ignore = false;
    _nested = false;
    _totalDx = 0;
    _totalDy = 0;
    _velocity = 0;
  }

  void _move(double dy) {
    final parent = widget.onDragUpdate;
    if (parent != null) {
      parent(dy);
      return;
    }
    setState(() => _offset = math.max(0, _offset + dy));
  }

  void _end(double velocity) {
    final parent = widget.onDragEnd;
    if (parent != null) {
      parent(velocity);
      return;
    }
    final close = velocity > 450 || _offset > 48;
    if (close && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    final from = _offset;
    void tick() {
      if (!mounted) return;
      setState(() {
        _offset = from * (1 - Curves.easeOutCubic.transform(_snap.value));
      });
    }

    _snap.addListener(tick);
    _snap.forward(from: 0).whenComplete(() {
      _snap.removeListener(tick);
      if (mounted) setState(() => _offset = 0);
    });
  }

  void _onDown(PointerDownEvent event) {
    if (_pointer != null) return;
    _pointer = event.pointer;
    _active = false;
    _ignore = false;
    _nested = false;
    _totalDx = 0;
    _totalDy = 0;
    _velocity = 0;
    _lastStamp = event.timeStamp;
  }

  void _onMove(PointerMoveEvent event) {
    if (event.pointer != _pointer || _ignore) return;
    final dt = event.timeStamp - _lastStamp;
    _lastStamp = event.timeStamp;
    if (dt > Duration.zero) {
      final instant = event.delta.dy / (dt.inMicroseconds / 1000000);
      _velocity = _velocity == 0 ? instant : _velocity * 0.45 + instant * 0.55;
    }
    _totalDx += event.delta.dx;
    _totalDy += event.delta.dy;
    if (_nested) {
      if (_active) {
        _active = false;
        _end(0);
      }
      _ignore = true;
      return;
    }
    if (!_active) {
      if (math.max(_totalDx.abs(), _totalDy.abs()) < 18) return;
      if (_totalDx.abs() > _totalDy.abs() || _totalDy < 0 || _scrolledAway) {
        _ignore = true;
        return;
      }
      _active = true;
      _move(_totalDy);
      return;
    }
    _move(event.delta.dy);
  }

  void _onUp(PointerEvent event) {
    if (event.pointer != _pointer) return;
    final active = _active;
    final velocity = _velocity;
    _resetPointer();
    if (active) _end(velocity);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: _onDown,
      onPointerMove: _onMove,
      onPointerUp: _onUp,
      onPointerCancel: _onUp,
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification.depth > 0 &&
              notification is ScrollUpdateNotification &&
              notification.dragDetails != null) {
            _nested = true;
          }
          return false;
        },
        child: Transform.translate(
          offset: Offset(0, _offset),
          child: widget.child,
        ),
      ),
    );
  }
}
