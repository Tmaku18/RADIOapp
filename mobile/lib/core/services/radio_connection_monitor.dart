import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../app_messenger.dart';
import 'audio_player_service.dart';

enum RadioConnectionState {
  /// Requests are landing and audio is flowing.
  online,

  /// Still nominally connected, but requests are failing or audio has been
  /// stalled long enough that we can no longer trust sync.
  degraded,

  /// The device reports no network interface at all.
  offline,
}

extension RadioConnectionStateX on RadioConnectionState {
  bool get isHealthy => this == RadioConnectionState.online;

  /// True whenever sync should hold off — the local clock reading is either
  /// frozen (stalled decoder) or can't be refreshed (failing requests).
  bool get isImpaired => this != RadioConnectionState.online;
}

/// Watches the health of the radio connection and reports it to the UI.
///
/// Three independent signals feed the state, because any one of them alone
/// gives false readings: the OS can report a live interface on a cell link that
/// passes no traffic, and a healthy link can still stall the decoder behind a
/// slow CDN edge.
///
///  * `connectivity_plus` — hard offline (airplane mode, no interface)
///  * consecutive `/radio/current` network failures
///  * sustained `ProcessingState.buffering` while playback is meant to run
///
/// Consumers listen to [state] (a [ValueNotifier], matching the
/// `userPausedNotifier` pattern already used by the audio handler) and register
/// an [onRestored] callback to force a resync when service comes back.
class RadioConnectionMonitor {
  RadioConnectionMonitor._();
  static final RadioConnectionMonitor instance = RadioConnectionMonitor._();

  /// Failures tolerated before we call the connection degraded. Two misses of
  /// the 10s poll (~20s of silence) is a real problem, one is a blip.
  static const int _failureThreshold = 2;

  /// How long the decoder may sit in `buffering` before we treat it as a stall
  /// rather than normal rebuffering. Song boundaries and cellular handoffs
  /// routinely take several seconds, and calling those a weak connection just
  /// trains listeners to ignore the warning.
  static const Duration _bufferingStallThreshold = Duration(seconds: 12);

  /// Minimum spacing between notices. A flapping link would otherwise bury the
  /// screen in snackbars.
  static const Duration _noticeCooldown = Duration(seconds: 20);

  final ValueNotifier<RadioConnectionState> state =
      ValueNotifier<RadioConnectionState>(RadioConnectionState.online);

  final List<Future<void> Function()> _restoreListeners = [];

  StreamSubscription<List<ConnectivityResult>>? _connectivitySub;
  StreamSubscription<PlayerState>? _playerSub;
  Timer? _bufferingTimer;

  bool _started = false;
  int _consecutiveFailures = 0;
  bool _hardOffline = false;
  bool _bufferingStalled = false;
  DateTime _lastNoticeAt = DateTime.fromMillisecondsSinceEpoch(0);
  bool _announcedImpairment = false;

  RadioConnectionState get current => state.value;

  /// Register a callback fired once when the connection returns to healthy.
  /// Used by the sync owners to immediately re-fetch the live position.
  void addRestoreListener(Future<void> Function() listener) {
    _restoreListeners.add(listener);
  }

  void removeRestoreListener(Future<void> Function() listener) {
    _restoreListeners.remove(listener);
  }

  void start() {
    if (_started) return;
    _started = true;

    _connectivitySub = Connectivity().onConnectivityChanged.listen(
      _onConnectivityChanged,
      onError: (_) {
        // Platform channel hiccup — fall back to request/buffer signals.
      },
    );
    unawaited(_primeConnectivity());

    _playerSub = AudioPlayerService().player.playerStateStream.listen(
      _onPlayerState,
    );
  }

  Future<void> _primeConnectivity() async {
    try {
      _onConnectivityChanged(await Connectivity().checkConnectivity());
    } catch (_) {
      // Best effort; the stream will correct us.
    }
  }

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    final offline =
        results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    if (_hardOffline == offline) return;
    _hardOffline = offline;
    if (!offline) {
      // A fresh interface deserves a clean slate — old failures were from the
      // link that just went away.
      _consecutiveFailures = 0;
    }
    _recompute();
  }

  void _onPlayerState(PlayerState playerState) {
    final buffering =
        playerState.playing &&
        playerState.processingState == ProcessingState.buffering;

    if (!buffering) {
      _bufferingTimer?.cancel();
      _bufferingTimer = null;
      if (_bufferingStalled) {
        _bufferingStalled = false;
        _recompute();
      }
      return;
    }

    // Already counting, or already flagged — don't restart the clock.
    if (_bufferingTimer != null || _bufferingStalled) return;
    _bufferingTimer = Timer(_bufferingStallThreshold, () {
      _bufferingTimer = null;
      _bufferingStalled = true;
      _recompute();
    });
  }

  /// Report the outcome of a radio API call. [networkError] means the request
  /// never reached the service, as opposed to the station being empty.
  void reportRequestResult({required bool networkError}) {
    if (networkError) {
      if (_consecutiveFailures < _failureThreshold) _consecutiveFailures++;
    } else {
      if (_consecutiveFailures == 0) return;
      _consecutiveFailures = 0;
    }
    _recompute();
  }

  void _recompute() {
    final next = _hardOffline
        ? RadioConnectionState.offline
        : (_consecutiveFailures >= _failureThreshold || _bufferingStalled)
        ? RadioConnectionState.degraded
        : RadioConnectionState.online;

    final previous = state.value;
    if (previous == next) return;
    state.value = next;

    _announce(next);

    if (next == RadioConnectionState.online) {
      unawaited(_notifyRestored());
    }
  }

  /// Tell the listener what happened, but only on a real transition into or out
  /// of trouble — not on every offline/degraded reshuffle.
  void _announce(RadioConnectionState next) {
    final impaired = next.isImpaired;
    if (impaired == _announcedImpairment) return;

    // Rate-limit only the bad news; a flapping link would otherwise spam. The
    // all-clear always goes out, so we never leave a "weak connection" warning
    // standing after the problem is gone.
    final now = DateTime.now();
    if (impaired && now.difference(_lastNoticeAt) < _noticeCooldown) return;
    _lastNoticeAt = now;
    _announcedImpairment = impaired;

    showAppSnackBar(
      SnackBar(
        content: Text(
          impaired
              ? next == RadioConnectionState.offline
                    ? 'You\u2019re offline \u2014 radio will resync when you\u2019re back.'
                    : 'Weak connection \u2014 radio may fall out of sync.'
              : 'Back online \u2014 radio resynced.',
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  Future<void> _notifyRestored() async {
    for (final listener in List.of(_restoreListeners)) {
      try {
        await listener();
      } catch (_) {
        // A failing resync must not block the others.
      }
    }
  }

  @visibleForTesting
  void resetForTest() {
    _consecutiveFailures = 0;
    _hardOffline = false;
    _bufferingStalled = false;
    _bufferingTimer?.cancel();
    _bufferingTimer = null;
    state.value = RadioConnectionState.online;
  }

  void dispose() {
    _connectivitySub?.cancel();
    _playerSub?.cancel();
    _bufferingTimer?.cancel();
    _restoreListeners.clear();
    _started = false;
  }
}
