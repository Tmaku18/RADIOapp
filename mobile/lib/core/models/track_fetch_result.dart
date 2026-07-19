import 'track.dart';

class TrackFetchResult {
  final Track? track;
  final bool noContent;
  final String? message;

  const TrackFetchResult({
    required this.track,
    this.noContent = false,
    this.message,
  });

  const TrackFetchResult.noContent([this.message])
      : track = null,
        noContent = true;
}

