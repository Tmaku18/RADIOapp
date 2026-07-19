/// Shared helpers for keeping mobile radio playback aligned with the server.
library;

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

bool isStaleRadioServerTrack(
  String? serverTrackId,
  RecentlyAdvancedFrom? recentlyAdvancedFrom,
) {
  if (serverTrackId == null || recentlyAdvancedFrom == null) return false;
  if (recentlyAdvancedFrom.id != serverTrackId) return false;
  return DateTime.now().difference(recentlyAdvancedFrom.at).inSeconds < 12;
}
