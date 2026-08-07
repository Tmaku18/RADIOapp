class ProRadioAccess {
  final bool hasAccess;
  final String? status;
  final String? currentPeriodEnd;
  final int regularCents;
  final int introCents;
  /// True while beta unlocks Pro-Radio without a paid subscription.
  final bool betaFree;

  const ProRadioAccess({
    required this.hasAccess,
    required this.status,
    required this.currentPeriodEnd,
    required this.regularCents,
    required this.introCents,
    this.betaFree = false,
  });

  factory ProRadioAccess.fromJson(Map<String, dynamic> json) {
    final pricing = json['pricing'];
    int regular = 999;
    int intro = 499;
    if (pricing is Map) {
      regular = int.tryParse('${pricing['regularCents'] ?? 999}') ?? 999;
      intro = int.tryParse('${pricing['introCents'] ?? 499}') ?? 499;
    }
    return ProRadioAccess(
      hasAccess: json['hasAccess'] == true,
      status: json['status']?.toString(),
      currentPeriodEnd: json['currentPeriodEnd']?.toString(),
      regularCents: regular,
      introCents: intro,
      betaFree: json['betaFree'] == true,
    );
  }
}

class ProRadioPlaylist {
  final String id;
  final String title;
  final String? description;
  final String? coverUrl;
  final int trackCount;

  const ProRadioPlaylist({
    required this.id,
    required this.title,
    this.description,
    this.coverUrl,
    this.trackCount = 0,
  });

  factory ProRadioPlaylist.fromJson(Map<String, dynamic> json) {
    return ProRadioPlaylist(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Playlist').toString(),
      description: json['description']?.toString(),
      coverUrl: json['coverUrl']?.toString(),
      trackCount: int.tryParse('${json['trackCount'] ?? 0}') ?? 0,
    );
  }
}

class ProRadioPlaylistTrack {
  final String songId;
  final String title;
  final String? artistName;
  final String? artworkUrl;
  final int durationSeconds;
  final String? streamUrl;

  const ProRadioPlaylistTrack({
    required this.songId,
    required this.title,
    this.artistName,
    this.artworkUrl,
    this.durationSeconds = 0,
    this.streamUrl,
  });

  factory ProRadioPlaylistTrack.fromJson(Map<String, dynamic> json) {
    return ProRadioPlaylistTrack(
      songId: (json['songId'] ?? '').toString(),
      title: (json['title'] ?? 'Track').toString(),
      artistName: json['artistName']?.toString(),
      artworkUrl: json['artworkUrl']?.toString(),
      durationSeconds: int.tryParse('${json['durationSeconds'] ?? 0}') ?? 0,
      streamUrl: json['streamUrl']?.toString(),
    );
  }
}

/// One item in the on-demand Pro-Radio queue.
class ProRadioQueueItem {
  final String songId;
  final String title;
  final String? artistName;
  final String? artworkUrl;
  final String audioUrl;

  const ProRadioQueueItem({
    required this.songId,
    required this.title,
    required this.audioUrl,
    this.artistName,
    this.artworkUrl,
  });
}
