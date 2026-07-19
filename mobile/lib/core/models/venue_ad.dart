class VenueAd {
  final String id;
  final String imageUrl;
  final String? linkUrl;
  final String stationId;

  const VenueAd({
    required this.id,
    required this.imageUrl,
    required this.stationId,
    this.linkUrl,
  });

  factory VenueAd.fromJson(Map<String, dynamic> json) {
    return VenueAd(
      id: (json['id'] ?? '').toString(),
      imageUrl: (json['imageUrl'] ?? json['image_url'] ?? '').toString(),
      linkUrl: (json['linkUrl'] ?? json['link_url'])?.toString(),
      stationId: (json['stationId'] ?? json['station_id'] ?? 'global').toString(),
    );
  }
}

