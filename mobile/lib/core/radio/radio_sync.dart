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

bool isServerAheadMidSong({
  required bool trackIdentityChanged,
  required bool isPlaying,
  required bool userPaused,
  required int currentTimeSeconds,
  required int durationSeconds,
}) {
  if (!trackIdentityChanged || !isPlaying || userPaused) return false;
  return !isNearRadioTrackEnd(
    currentTimeSeconds: currentTimeSeconds,
    durationSeconds: durationSeconds,
  );
}

bool isStaleRadioServerTrack(
  String? serverTrackId,
  RecentlyAdvancedFrom? recentlyAdvancedFrom,
) {
  if (serverTrackId == null || recentlyAdvancedFrom == null) return false;
  if (recentlyAdvancedFrom.id != serverTrackId) return false;
  return DateTime.now().difference(recentlyAdvancedFrom.at).inSeconds < 12;
}
