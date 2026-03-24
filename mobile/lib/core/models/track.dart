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

  /// Trial-by-Fire indicator (daily scheduled window).
  final bool trialByFireActive;

  /// Server-reported position (seconds) if provided.
  final int positionSeconds;

  /// Live listener count reported by the radio backend.
  final int listenerCount;

  /// Remaining server-side track time in milliseconds.
  final int timeRemainingMs;

  /// Crowd sentiment votes for current play.
  final int fireVotes;
  final int shitVotes;

  /// Percentage of positive votes (0..100), where higher is hotter.
  final int temperaturePercent;

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
    this.trialByFireActive = false,
    this.positionSeconds = 0,
    this.listenerCount = 0,
    this.timeRemainingMs = 0,
    this.fireVotes = 0,
    this.shitVotes = 0,
    this.temperaturePercent = 50,
    this.pinnedCatalysts = const [],
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    final pinnedRaw = json['pinned_catalysts'];
    final pinned = <PinnedCatalystCredit>[];
    if (pinnedRaw is List) {
      for (final item in pinnedRaw) {
        if (item is Map) {
          pinned.add(
            PinnedCatalystCredit.fromJson(
              item.map((k, v) => MapEntry(k.toString(), v)),
            ),
          );
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
      durationSeconds:
          (json['duration_seconds'] ?? json['durationSeconds'] ?? 180) is int
          ? (json['duration_seconds'] ?? json['durationSeconds'] ?? 180) as int
          : int.tryParse(
                  (json['duration_seconds'] ?? json['durationSeconds'] ?? '180')
                      .toString(),
                ) ??
                180,
      playId: (json['play_id'] ?? json['playId'])?.toString(),
      isLiveBroadcast: json['is_live'] == true || json['isLive'] == true,
      trialByFireActive:
          json['trial_by_fire_active'] == true ||
          json['trialByFireActive'] == true,
      positionSeconds:
          (json['position_seconds'] ?? json['positionSeconds'] ?? 0) is int
          ? (json['position_seconds'] ?? json['positionSeconds'] ?? 0) as int
          : int.tryParse(
                  (json['position_seconds'] ?? json['positionSeconds'] ?? '0')
                      .toString(),
                ) ??
                0,
      listenerCount:
          (json['listener_count'] ?? json['listenerCount'] ?? 0) is int
          ? (json['listener_count'] ?? json['listenerCount'] ?? 0) as int
          : int.tryParse(
                  (json['listener_count'] ?? json['listenerCount'] ?? '0')
                      .toString(),
                ) ??
                0,
      timeRemainingMs:
          (json['time_remaining_ms'] ?? json['timeRemainingMs'] ?? 0) is int
          ? (json['time_remaining_ms'] ?? json['timeRemainingMs'] ?? 0) as int
          : int.tryParse(
                  (json['time_remaining_ms'] ?? json['timeRemainingMs'] ?? '0')
                      .toString(),
                ) ??
                0,
      fireVotes: (json['fire_votes'] ?? json['fireVotes'] ?? 0) is int
          ? (json['fire_votes'] ?? json['fireVotes'] ?? 0) as int
          : int.tryParse(
                  (json['fire_votes'] ?? json['fireVotes'] ?? '0').toString(),
                ) ??
                0,
      shitVotes: (json['shit_votes'] ?? json['shitVotes'] ?? 0) is int
          ? (json['shit_votes'] ?? json['shitVotes'] ?? 0) as int
          : int.tryParse(
                  (json['shit_votes'] ?? json['shitVotes'] ?? '0').toString(),
                ) ??
                0,
      temperaturePercent:
          (json['temperature_percent'] ?? json['temperaturePercent'] ?? 50)
              is int
          ? (json['temperature_percent'] ?? json['temperaturePercent'] ?? 50)
                as int
          : int.tryParse(
                  (json['temperature_percent'] ??
                          json['temperaturePercent'] ??
                          '50')
                      .toString(),
                ) ??
                50,
      pinnedCatalysts: pinned,
    );
  }

  Track copyWith({
    String? id,
    String? title,
    String? artistName,
    String? artistId,
    String? audioUrl,
    String? artworkUrl,
    int? durationSeconds,
    String? playId,
    bool? isLiveBroadcast,
    bool? trialByFireActive,
    int? positionSeconds,
    int? listenerCount,
    int? timeRemainingMs,
    int? fireVotes,
    int? shitVotes,
    int? temperaturePercent,
    List<PinnedCatalystCredit>? pinnedCatalysts,
  }) {
    return Track(
      id: id ?? this.id,
      title: title ?? this.title,
      artistName: artistName ?? this.artistName,
      artistId: artistId ?? this.artistId,
      audioUrl: audioUrl ?? this.audioUrl,
      artworkUrl: artworkUrl ?? this.artworkUrl,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      playId: playId ?? this.playId,
      isLiveBroadcast: isLiveBroadcast ?? this.isLiveBroadcast,
      trialByFireActive: trialByFireActive ?? this.trialByFireActive,
      positionSeconds: positionSeconds ?? this.positionSeconds,
      listenerCount: listenerCount ?? this.listenerCount,
      timeRemainingMs: timeRemainingMs ?? this.timeRemainingMs,
      fireVotes: fireVotes ?? this.fireVotes,
      shitVotes: shitVotes ?? this.shitVotes,
      temperaturePercent: temperaturePercent ?? this.temperaturePercent,
      pinnedCatalysts: pinnedCatalysts ?? this.pinnedCatalysts,
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
