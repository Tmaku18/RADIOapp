class DiscoveryMapHeatBucket {
  final double lat;
  final double lng;
  final int intensity;
  final int totalLikes;
  final int artistCount;

  const DiscoveryMapHeatBucket({
    required this.lat,
    required this.lng,
    required this.intensity,
    required this.totalLikes,
    required this.artistCount,
  });

  factory DiscoveryMapHeatBucket.fromJson(Map<String, dynamic> json) {
    return DiscoveryMapHeatBucket(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      intensity: (json['intensity'] as num?)?.toInt() ?? 0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      artistCount: (json['artistCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class DiscoveryMapCluster {
  final String id;
  final double lat;
  final double lng;
  final int artistCount;
  final int totalLikes;
  final int radiusKm;

  const DiscoveryMapCluster({
    required this.id,
    required this.lat,
    required this.lng,
    required this.artistCount,
    required this.totalLikes,
    required this.radiusKm,
  });

  factory DiscoveryMapCluster.fromJson(Map<String, dynamic> json) {
    return DiscoveryMapCluster(
      id: json['id']?.toString() ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      artistCount: (json['artistCount'] as num?)?.toInt() ?? 0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      radiusKm: (json['radiusKm'] as num?)?.toInt() ?? 0,
    );
  }
}

class DiscoveryMapArtistMarker {
  final String artistId;
  final String? displayName;
  final String? avatarUrl;
  final String? locationRegion;
  final double lat;
  final double lng;
  final int likeCount;

  const DiscoveryMapArtistMarker({
    required this.artistId,
    required this.displayName,
    required this.avatarUrl,
    required this.locationRegion,
    required this.lat,
    required this.lng,
    required this.likeCount,
  });

  factory DiscoveryMapArtistMarker.fromJson(Map<String, dynamic> json) {
    return DiscoveryMapArtistMarker(
      artistId: json['artistId']?.toString() ?? '',
      displayName: json['displayName']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      locationRegion: json['locationRegion']?.toString(),
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }
}
