class Song {
  final String id;
  final String artistId;
  final String title;
  final String artistName;
  final String audioUrl;
  final String? artworkUrl;
  final int? durationSeconds;
  final int? fileSizeBytes;
  final int creditsRemaining;
  final int playCount;
  final int? listenCount;
  final int likeCount;
  final int skipCount;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  /// True when the song is in The Refinery for Prospector review (`/songs/mine`).
  final bool inRefinery;
  /// Public 30s preview URL (null until rendered).
  final String? sampleUrl;
  final int sampleStartSeconds;
  final int? sampleEndSeconds;
  final int priceCents;
  final bool forSale;
  final bool discoverEnabled;
  final int? discoverClipStartSeconds;
  final int? discoverClipEndSeconds;

  Song({
    required this.id,
    required this.artistId,
    required this.title,
    required this.artistName,
    required this.audioUrl,
    this.artworkUrl,
    this.durationSeconds,
    this.fileSizeBytes,
    required this.creditsRemaining,
    required this.playCount,
    this.listenCount,
    required this.likeCount,
    required this.skipCount,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.inRefinery = false,
    this.sampleUrl,
    this.sampleStartSeconds = 0,
    this.sampleEndSeconds,
    this.priceCents = 99,
    this.forSale = true,
    this.discoverEnabled = false,
    this.discoverClipStartSeconds,
    this.discoverClipEndSeconds,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    int parseIntOr(dynamic value, int fallback) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    final id = json['id']?.toString() ?? '';
    final artistId = (json['artist_id'] ?? json['artistId'])?.toString() ?? '';
    return Song(
      id: id,
      artistId: artistId.isNotEmpty ? artistId : id,
      title: json['title']?.toString() ?? '',
      artistName: (json['artist_name'] ?? json['artistName'])?.toString() ?? '',
      audioUrl: (json['audio_url'] ?? json['audioUrl'])?.toString() ?? '',
      artworkUrl: (json['artwork_url'] ?? json['artworkUrl'])?.toString(),
      durationSeconds: json['duration_seconds'] ?? json['durationSeconds'] as int?,
      fileSizeBytes: json['file_size_bytes'] ?? json['fileSizeBytes'] as int?,
      creditsRemaining:
          (json['credits_remaining'] ?? json['creditsRemaining'] ?? 0) as int,
      playCount: (json['play_count'] ?? json['playCount'] ?? 0) as int,
      listenCount: (json['listen_count'] ?? json['listenCount']) as int?,
      likeCount: (json['like_count'] ?? json['likeCount'] ?? 0) as int,
      skipCount: (json['skip_count'] ?? json['skipCount'] ?? 0) as int,
      status: json['status']?.toString() ?? 'pending',
      inRefinery: json['inRefinery'] == true || json['in_refinery'] == true,
      sampleUrl: (json['sample_url'] ?? json['sampleUrl'])?.toString(),
      sampleStartSeconds: parseIntOr(
        json['sample_start_seconds'] ?? json['sampleStartSeconds'],
        0,
      ),
      sampleEndSeconds: (json['sample_end_seconds'] ?? json['sampleEndSeconds'])
          is num
          ? parseIntOr(json['sample_end_seconds'] ?? json['sampleEndSeconds'], 0)
          : null,
      priceCents: parseIntOr(
        json['price_cents'] ?? json['priceCents'],
        99,
      ),
      forSale: (json['is_for_sale'] ?? json['forSale']) != false,
      discoverEnabled:
          (json['discover_enabled'] ?? json['discoverEnabled']) == true,
      discoverClipStartSeconds:
          (json['discover_clip_start_seconds'] ?? json['discoverClipStartSeconds'])
              is num
          ? parseIntOr(
              json['discover_clip_start_seconds'] ??
                  json['discoverClipStartSeconds'],
              0,
            )
          : null,
      discoverClipEndSeconds:
          (json['discover_clip_end_seconds'] ?? json['discoverClipEndSeconds'])
              is num
          ? parseIntOr(
              json['discover_clip_end_seconds'] ?? json['discoverClipEndSeconds'],
              0,
            )
          : null,
      createdAt: DateTime.parse(
        (json['created_at'] ?? json['createdAt']).toString(),
      ),
      updatedAt: DateTime.parse(
        (json['updated_at'] ?? json['updatedAt']).toString(),
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'artist_id': artistId,
      'title': title,
      'artist_name': artistName,
      'audio_url': audioUrl,
      'artwork_url': artworkUrl,
      'duration_seconds': durationSeconds,
      'file_size_bytes': fileSizeBytes,
      'credits_remaining': creditsRemaining,
      'play_count': playCount,
      'listen_count': listenCount,
      'like_count': likeCount,
      'skip_count': skipCount,
      'status': status,
      'in_refinery': inRefinery,
      'sample_url': sampleUrl,
      'sample_start_seconds': sampleStartSeconds,
      'sample_end_seconds': sampleEndSeconds,
      'price_cents': priceCents,
      'is_for_sale': forSale,
      'discover_enabled': discoverEnabled,
      'discover_clip_start_seconds': discoverClipStartSeconds,
      'discover_clip_end_seconds': discoverClipEndSeconds,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
