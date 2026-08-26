class CopyrightMatch {
  final String? title;
  final List<String> artists;
  final String? album;
  final String? label;
  final double? score;

  const CopyrightMatch({
    this.title,
    this.artists = const [],
    this.album,
    this.label,
    this.score,
  });

  factory CopyrightMatch.fromJson(Map<String, dynamic> json) {
    final artistsRaw = json['artists'];
    final artists = <String>[];
    if (artistsRaw is List) {
      for (final artist in artistsRaw) {
        final name = artist?.toString().trim() ?? '';
        if (name.isNotEmpty) artists.add(name);
      }
    } else if (artistsRaw != null) {
      for (final artist in artistsRaw.toString().split(',')) {
        final name = artist.trim();
        if (name.isNotEmpty) artists.add(name);
      }
    }
    final scoreRaw = json['score'];
    double? score;
    if (scoreRaw is num) {
      score = scoreRaw.toDouble();
    } else if (scoreRaw != null) {
      score = double.tryParse(scoreRaw.toString());
    }
    String? asText(dynamic value) {
      final text = value?.toString().trim();
      return (text == null || text.isEmpty) ? null : text;
    }

    return CopyrightMatch(
      title: asText(json['title']),
      artists: artists,
      album: asText(json['album']),
      label: asText(json['label']),
      score: score,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'artists': artists,
      'album': album,
      'label': label,
      'score': score,
    };
  }

  String get catalogLabel {
    final name = (title ?? '').trim().isEmpty
        ? 'an existing recording'
        : title!.trim();
    if (artists.isEmpty) return '"$name"';
    return '"$name" by ${artists.join(', ')}';
  }
}

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
  /// Unique listeners for this song. Prefer this over [playCount] in artist UI.
  final int? earsReached;
  final int likeCount;
  final int skipCount;
  final String status;
  /// Present when [status] is `rejected` — shown to the artist in Studio.
  final String? rejectionReason;
  /// `flagged` when ACRCloud matched a commercial recording.
  final String? copyrightStatus;
  final CopyrightMatch? copyrightMatch;
  final DateTime createdAt;
  final DateTime updatedAt;
  /// True when the song is in The Refinery for Prospector review (`/songs/mine`).
  final bool inRefinery;
  /// Public 30s preview URL (null until rendered).
  final String? sampleUrl;
  // Sample/clip points support half-second precision (0.5s nudges).
  final double sampleStartSeconds;
  final double? sampleEndSeconds;
  final int priceCents;
  final bool forSale;
  /// `song` (sample-gated) or `beat` (full listen-before-buy marketplace).
  final String productKind;
  final bool discoverEnabled;
  final double? discoverClipStartSeconds;
  final double? discoverClipEndSeconds;
  /// Full stream via purchase or Pro-Radio (from artist profile API).
  final bool streamEntitled;
  final bool proRadioEligible;
  final bool locked;
  final String? albumId;
  final int? trackNumber;
  final String? albumTitle;

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
    this.earsReached,
    required this.likeCount,
    required this.skipCount,
    required this.status,
    this.rejectionReason,
    this.copyrightStatus,
    this.copyrightMatch,
    required this.createdAt,
    required this.updatedAt,
    this.inRefinery = false,
    this.sampleUrl,
    this.sampleStartSeconds = 0,
    this.sampleEndSeconds,
    this.priceCents = 99,
    this.forSale = true,
    this.productKind = 'song',
    this.discoverEnabled = false,
    this.discoverClipStartSeconds,
    this.discoverClipEndSeconds,
    this.streamEntitled = false,
    this.proRadioEligible = false,
    this.locked = true,
    this.albumId,
    this.trackNumber,
    this.albumTitle,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    int parseIntOr(dynamic value, int fallback) {
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value?.toString() ?? '') ?? fallback;
    }

    int? parseIntOrNull(dynamic value) {
      if (value == null) return null;
      if (value is int) return value;
      if (value is num) return value.toInt();
      return int.tryParse(value.toString());
    }

    double parseDoubleOr(dynamic value, double fallback) {
      if (value is num) return value.toDouble();
      return double.tryParse(value?.toString() ?? '') ?? fallback;
    }

    double? parseDoubleOrNull(dynamic value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      return double.tryParse(value.toString());
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
      durationSeconds:
          parseIntOrNull(json['duration_seconds'] ?? json['durationSeconds']),
      fileSizeBytes:
          parseIntOrNull(json['file_size_bytes'] ?? json['fileSizeBytes']),
      creditsRemaining: parseIntOr(
        json['credits_remaining'] ?? json['creditsRemaining'],
        0,
      ),
      playCount: parseIntOr(json['play_count'] ?? json['playCount'], 0),
      listenCount: json['listen_count'] != null || json['listenCount'] != null
          ? parseIntOr(json['listen_count'] ?? json['listenCount'], 0)
          : null,
      earsReached: json['ears_reached'] != null || json['earsReached'] != null
          ? parseIntOr(json['ears_reached'] ?? json['earsReached'], 0)
          : null,
      likeCount: parseIntOr(json['like_count'] ?? json['likeCount'], 0),
      skipCount: parseIntOr(json['skip_count'] ?? json['skipCount'], 0),
      status: json['status']?.toString() ?? 'pending',
      rejectionReason: (json['rejection_reason'] ?? json['rejectionReason'])
          ?.toString(),
      copyrightStatus:
          (json['copyright_status'] ?? json['copyrightStatus'])?.toString(),
      copyrightMatch: () {
        final raw = json['copyright_match'] ?? json['copyrightMatch'];
        if (raw is Map) {
          return CopyrightMatch.fromJson(
            Map<String, dynamic>.from(raw),
          );
        }
        return null;
      }(),
      inRefinery: json['inRefinery'] == true || json['in_refinery'] == true,
      sampleUrl: (json['sample_url'] ?? json['sampleUrl'])?.toString(),
      sampleStartSeconds: parseDoubleOr(
        json['sample_start_seconds'] ?? json['sampleStartSeconds'],
        0,
      ),
      sampleEndSeconds: parseDoubleOrNull(
        json['sample_end_seconds'] ?? json['sampleEndSeconds'],
      ),
      priceCents: parseIntOr(
        json['price_cents'] ?? json['priceCents'],
        99,
      ),
      forSale: (json['is_for_sale'] ?? json['forSale']) != false,
      productKind: () {
        final raw =
            (json['product_kind'] ?? json['productKind'] ?? 'song').toString();
        return raw == 'beat' ? 'beat' : 'song';
      }(),
      discoverEnabled:
          (json['discover_enabled'] ?? json['discoverEnabled']) == true,
      discoverClipStartSeconds: parseDoubleOrNull(
        json['discover_clip_start_seconds'] ?? json['discoverClipStartSeconds'],
      ),
      discoverClipEndSeconds: parseDoubleOrNull(
        json['discover_clip_end_seconds'] ?? json['discoverClipEndSeconds'],
      ),
      streamEntitled:
          json['streamEntitled'] == true || json['stream_entitled'] == true,
      proRadioEligible: json['proRadioEligible'] == true ||
          json['pro_radio_eligible'] == true,
      locked: json['locked'] == true,
      albumId: () {
        final v = json['albumId'] ?? json['album_id'];
        final s = v?.toString().trim();
        return (s == null || s.isEmpty) ? null : s;
      }(),
      trackNumber: () {
        final v = json['trackNumber'] ?? json['track_number'];
        if (v == null) return null;
        if (v is int) return v;
        if (v is num) return v.toInt();
        return int.tryParse(v.toString());
      }(),
      albumTitle: () {
        final v = json['albumTitle'] ?? json['album_title'];
        final s = v?.toString().trim();
        return (s == null || s.isEmpty) ? null : s;
      }(),
      // Artist-profile (and other lean payloads) often omit updated_at.
      // `DateTime.parse((null).toString())` becomes parse("null") and crashes
      // the Artist screen with FormatException: Invalid date format / null.
      createdAt: DateTime.tryParse(
            (json['created_at'] ?? json['createdAt'] ?? '').toString(),
          ) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt: DateTime.tryParse(
            (json['updated_at'] ?? json['updatedAt'] ?? '').toString(),
          ) ??
          DateTime.tryParse(
            (json['created_at'] ?? json['createdAt'] ?? '').toString(),
          ) ??
          DateTime.fromMillisecondsSinceEpoch(0),
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
      'ears_reached': earsReached,
      'like_count': likeCount,
      'skip_count': skipCount,
      'status': status,
      'rejection_reason': rejectionReason,
      'copyright_status': copyrightStatus,
      'copyright_match': copyrightMatch?.toJson(),
      'in_refinery': inRefinery,
      'sample_url': sampleUrl,
      'sample_start_seconds': sampleStartSeconds,
      'sample_end_seconds': sampleEndSeconds,
      'price_cents': priceCents,
      'is_for_sale': forSale,
      'product_kind': productKind,
      'discover_enabled': discoverEnabled,
      'discover_clip_start_seconds': discoverClipStartSeconds,
      'discover_clip_end_seconds': discoverClipEndSeconds,
      'stream_entitled': streamEntitled,
      'pro_radio_eligible': proRadioEligible,
      'locked': locked,
      'album_id': albumId,
      'track_number': trackNumber,
      'album_title': albumTitle,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  bool get isBeat => productKind == 'beat';

  bool get isCopyrightFlagged =>
      (copyrightStatus ?? '').toLowerCase() == 'flagged';

  bool get hasCopyrightMatchDetails =>
      copyrightMatch != null &&
      ((copyrightMatch!.title?.trim().isNotEmpty ?? false) ||
          copyrightMatch!.artists.isNotEmpty);

  /// Show the matched catalog recording to the uploader (not after approve).
  bool get showCopyrightMatchCard =>
      status != 'approved' &&
      (isCopyrightFlagged ||
          (status == 'rejected' && hasCopyrightMatchDetails));

  /// Unique listeners shown on My Songs. Falls back to listens, then spins,
  /// so an older payload still has a number instead of a blank.
  int get earsReachedCount => earsReached ?? listenCount ?? playCount;
}
