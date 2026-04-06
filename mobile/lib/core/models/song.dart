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
  });

  factory Song.fromJson(Map<String, dynamic> json) {
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
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
