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
  final int likeCount;
  final int skipCount;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;

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
    required this.likeCount,
    required this.skipCount,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    return Song(
      id: json['id'],
      artistId: json['artist_id'],
      title: json['title'],
      artistName: json['artist_name'],
      audioUrl: json['audio_url'],
      artworkUrl: json['artwork_url'],
      durationSeconds: json['duration_seconds'],
      fileSizeBytes: json['file_size_bytes'],
      creditsRemaining: json['credits_remaining'] ?? 0,
      playCount: json['play_count'] ?? 0,
      likeCount: json['like_count'] ?? 0,
      skipCount: json['skip_count'] ?? 0,
      status: json['status'],
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
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
      'like_count': likeCount,
      'skip_count': skipCount,
      'status': status,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
