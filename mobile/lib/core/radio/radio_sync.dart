/// Shared helpers for keeping mobile radio playback aligned with the server.
library;

import '../models/track.dart';

class RecentlyAdvancedFrom {
  RecentlyAdvancedFrom({required this.id, required this.at});
  final String id;
  final DateTime at;
}

bool isNearRadioTrackEnd({
  required int currentTimeSeconds,
  required int durationSeconds,
  int thresholdSeconds = 8,
}) {
  if (durationSeconds <= 0) return true;
  return currentTimeSeconds >= durationSeconds - thresholdSeconds;
}

/// Hard live sync: a playing listener always follows the server's current song,
/// even mid-song, so every device on a station hears the same track at the same
/// position. (Previously this returned true mid-song to avoid interrupting a
/// listener, but that let devices drift onto different songs — "true radio" must
/// stay locked.) Explicit user pause is still respected by `_loadTrack`
/// (volume 0, no play) and the just-advanced guard via `isStaleRadioServerTrack`.
bool isServerAheadMidSong({
  required bool trackIdentityChanged,
  required bool isPlaying,
  required bool userPaused,
  required int currentTimeSeconds,
  required int durationSeconds,
}) {
  return false;
}

/// How close to the end of a song we stop reloading and wait for the boundary.
const int kRadioBoundaryHandoffSeconds = 5;

/// Whether to leave local playback alone when the server has already moved to
/// the next song but ours is about to finish anyway.
///
/// Swapping the audio source throws away the buffer and restarts buffering,
/// which listeners hear as a hiccup. Inside the handoff window the end-of-song
/// handler is about to make the same transition cleanly, so the reload costs a
/// glitch and buys nothing.
///
/// Only defers while playback is actually moving. A paused or stalled decoder
/// never reaches the boundary handler, so deferring to it would park the device
/// on a finished song while the station plays on without it.
bool shouldDeferTrackSwitchToBoundary({
  required int localSeconds,
  required int durationSeconds,
  required bool isPlaying,
  int thresholdSeconds = kRadioBoundaryHandoffSeconds,
}) {
  if (!isPlaying) return false;
  if (durationSeconds <= 0) return false;
  final remaining = durationSeconds - localSeconds;
  return remaining > 0 && remaining <= thresholdSeconds;
}

bool isStaleRadioServerTrack(
  String? serverTrackId,
  RecentlyAdvancedFrom? recentlyAdvancedFrom,
) {
  if (serverTrackId == null || recentlyAdvancedFrom == null) return false;
  if (recentlyAdvancedFrom.id != serverTrackId) return false;
  return DateTime.now().difference(recentlyAdvancedFrom.at).inSeconds < 12;
}

/// Ceiling on how much latency we trust. Beyond this the request was so slow
/// that the payload is better treated as a rough hint than a clock reading.
const int _maxCompensationSeconds = 45;

/// Where the song actually is *right now* on the live timeline.
///
/// [Track.positionSeconds] is a snapshot from when the server built the
/// response. On a weak connection the reply can take many seconds to arrive, so
/// seeking straight to that number lands behind the live point and the song
/// audibly jumps backwards. Project it forward by the time elapsed since the
/// response arrived, plus half the round trip (the return leg we already spent).
int liveTargetSeconds(Track track, {DateTime? now}) {
  final receivedAt = track.receivedAt;
  if (receivedAt == null) return track.positionSeconds;

  final at = now ?? DateTime.now();
  final sinceReceivedMs = at.difference(receivedAt).inMilliseconds;
  // A clock that moved backwards (NTP correction, device sleep) must never
  // rewind the target.
  final elapsedMs = sinceReceivedMs > 0 ? sinceReceivedMs : 0;
  final returnLegMs = (track.rttMs > 0 ? track.rttMs : 0) ~/ 2;

  final compensationSeconds = ((elapsedMs + returnLegMs) / 1000).round().clamp(
    0,
    _maxCompensationSeconds,
  );
  return track.positionSeconds + compensationSeconds;
}

/// What to do about the gap between local playback and the live timeline.
enum RadioSyncAction {
  /// Close enough, or unsafe to act right now.
  none,

  /// Gap is small — nudge playback rate and let it close on its own.
  nudge,

  /// Gap is too large to nudge away; jump to the live point.
  seek,
}

class RadioSyncDecision {
  const RadioSyncDecision(this.action, {this.speed = 1.0, this.targetSeconds});

  final RadioSyncAction action;

  /// Playback rate to apply for [RadioSyncAction.nudge], or 1.0 to restore.
  final double speed;

  /// Absolute position to seek to for [RadioSyncAction.seek].
  final int? targetSeconds;

  static const none = RadioSyncDecision(RadioSyncAction.none);
}

/// Drift below this is inaudible — leave playback completely alone.
const int kRadioSyncToleranceSeconds = 2;

/// Above this we can no longer catch up by nudging the rate in reasonable time.
const int kRadioSyncHardSeekSeconds = 20;

/// Speed used to catch up when we are behind the live point.
const double kRadioCatchUpSpeed = 1.03;

/// Speed used to fall back when we are ahead of the live point. Seeking
/// backwards is what listeners hear as a glitch, so we never do it mid-song.
const double kRadioEaseBackSpeed = 0.98;

/// Decide how to reconcile local playback with the live timeline.
///
/// Deliberately conservative on weak connections: a seek forces a fresh HTTP
/// range request at an unbuffered offset, which throws away the 30-60s buffer
/// and restarts buffering — the exact thrash loop that makes bad networks
/// worse. So we only seek when the gap is genuinely too big to nudge away, and
/// we never seek backwards while the same song is playing.
RadioSyncDecision decideRadioSync({
  required int localSeconds,
  required int targetSeconds,
  required int durationSeconds,
  required bool isBuffering,
  required bool connectionDegraded,
  required double currentSpeed,
}) {
  // While buffering or on a degraded link the local position is frozen and the
  // gap is measuring the stall, not real drift. Correcting here is what starts
  // the thrash loop. Restore normal speed and wait for a healthy reading.
  if (isBuffering || connectionDegraded) {
    return currentSpeed == 1.0
        ? RadioSyncDecision.none
        : const RadioSyncDecision(RadioSyncAction.nudge, speed: 1.0);
  }

  final behind = targetSeconds - localSeconds;
  final gap = behind.abs();

  if (gap <= kRadioSyncToleranceSeconds) {
    return currentSpeed == 1.0
        ? RadioSyncDecision.none
        : const RadioSyncDecision(RadioSyncAction.nudge, speed: 1.0);
  }

  // Near the end of the song there is no runway to catch up, and a seek would
  // only clip the outro — the track boundary handler is about to rotate anyway.
  final remaining = durationSeconds - localSeconds;
  if (durationSeconds > 0 && remaining <= kRadioSyncToleranceSeconds) {
    return currentSpeed == 1.0
        ? RadioSyncDecision.none
        : const RadioSyncDecision(RadioSyncAction.nudge, speed: 1.0);
  }

  if (behind > kRadioSyncHardSeekSeconds) {
    // Far behind (long stall, device sleep). Nudging would take minutes.
    return RadioSyncDecision(
      RadioSyncAction.seek,
      targetSeconds: targetSeconds,
    );
  }

  if (behind > 0) {
    // Behind but within catch-up range: speed up slightly. Pitch is preserved
    // by ExoPlayer and AVPlayer, so this is inaudible at 1.03x.
    return currentSpeed == kRadioCatchUpSpeed
        ? RadioSyncDecision.none
        : const RadioSyncDecision(
            RadioSyncAction.nudge,
            speed: kRadioCatchUpSpeed,
          );
  }

  // Ahead of the live point. Never seek backwards mid-song — ease off instead.
  return currentSpeed == kRadioEaseBackSpeed
      ? RadioSyncDecision.none
      : const RadioSyncDecision(
          RadioSyncAction.nudge,
          speed: kRadioEaseBackSpeed,
        );
}
