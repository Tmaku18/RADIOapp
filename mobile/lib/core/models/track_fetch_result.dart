import 'track.dart';

class TrackFetchResult {
  final Track? track;
  final bool noContent;
  final String? message;

  /// True when the request failed to reach the radio service (timeout, DNS,
  /// socket drop) rather than the station genuinely having nothing to play.
  ///
  /// Callers must treat these differently: an empty station should clear the
  /// now-playing UI, but a dropped request on a weak connection should leave
  /// playback and the UI exactly as they were.
  final bool networkError;

  const TrackFetchResult({
    required this.track,
    this.noContent = false,
    this.message,
    this.networkError = false,
  });

  const TrackFetchResult.noContent([this.message])
      : track = null,
        noContent = true,
        networkError = false;

  const TrackFetchResult.networkError([this.message])
      : track = null,
        noContent = true,
        networkError = true;
}

