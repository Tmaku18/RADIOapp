/// Lightweight track model for radio playback endpoints (`/radio/current`, `/radio/next`).
///
/// Web and backend use `audio_url`, `artist_name`, etc. This is intentionally
/// separate from `Song` which represents database songs with credits/analytics.
class Track {
  final String id;
  final String title;
  final String artistName;
  final String? artistId;
  final String audioUrl;
  final String? artworkUrl;
  final int durationSeconds;

  /// Unique play instance id (for one-vote-per-play on radio).
  final String? playId;

  /// Backend may mark a broadcast as live (e.g., DJ/live session).
  final bool isLiveBroadcast;

  /// Server-reported position (seconds) if provided.
  final int positionSeconds;

  /// Catalyst deep-link credits pinned during this song's airtime.
  final List<PinnedCatalystCredit> pinnedCatalysts;

  Track({
    required this.id,
    required this.title,
    required this.artistName,
    this.artistId,
    required this.audioUrl,
    this.artworkUrl,
    required this.durationSeconds,
    this.playId,
    this.isLiveBroadcast = false,
    this.positionSeconds = 0,
    this.pinnedCatalysts = const [],
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    final pinnedRaw = json['pinned_catalysts'];
    final pinned = <PinnedCatalystCredit>[];
    if (pinnedRaw is List) {
      for (final item in pinnedRaw) {
        if (item is Map) {
          pinned.add(PinnedCatalystCredit.fromJson(
            item.map((k, v) => MapEntry(k.toString(), v)),
          ));
        }
      }
    }

    return Track(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistName: (json['artist_name'] ?? json['artistName'] ?? 'Unknown')
          .toString(),
      artistId: (json['artist_id'] ?? json['artistId'])?.toString(),
      audioUrl: (json['audio_url'] ?? json['audioUrl'] ?? '').toString(),
      artworkUrl: (json['artwork_url'] ?? json['artworkUrl'])?.toString(),
      durationSeconds: (json['duration_seconds'] ?? json['durationSeconds'] ?? 180)
          is int
          ? (json['duration_seconds'] ?? json['durationSeconds'] ?? 180) as int
          : int.tryParse(
                  (json['duration_seconds'] ?? json['durationSeconds'] ?? '180')
                      .toString(),
                ) ??
              180,
      playId: (json['play_id'] ?? json['playId'])?.toString(),
      isLiveBroadcast: json['is_live'] == true || json['isLive'] == true,
      positionSeconds: (json['position_seconds'] ?? json['positionSeconds'] ?? 0)
          is int
          ? (json['position_seconds'] ?? json['positionSeconds'] ?? 0) as int
          : int.tryParse(
                  (json['position_seconds'] ?? json['positionSeconds'] ?? '0')
                      .toString(),
                ) ??
              0,
      pinnedCatalysts: pinned,
    );
  }
}

class PinnedCatalystCredit {
  final String userId;
  final String displayName;
  final String? avatarUrl;
  final String role;

  const PinnedCatalystCredit({
    required this.userId,
    required this.displayName,
    required this.role,
    this.avatarUrl,
  });

  factory PinnedCatalystCredit.fromJson(Map<String, dynamic> json) {
    return PinnedCatalystCredit(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      displayName:
          (json['displayName'] ?? json['display_name'] ?? 'Industry Catalyst')
              .toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      role: (json['role'] ?? 'other').toString(),
    );
  }
}

