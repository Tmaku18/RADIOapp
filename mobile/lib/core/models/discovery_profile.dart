class DiscoveryProfile {
  final String id;
  final String? displayName;
  final String? avatarUrl;
  final String? headline;
  final String? bio;
  final String role;
  final String? locationRegion;
  final bool mentorOptIn;
  final double? distanceKm;

  const DiscoveryProfile({
    required this.id,
    required this.role,
    this.displayName,
    this.avatarUrl,
    this.headline,
    this.bio,
    this.locationRegion,
    this.mentorOptIn = false,
    this.distanceKm,
  });

  factory DiscoveryProfile.fromJson(Map<String, dynamic> json) {
    final dist = json['distanceKm'] ?? json['distance_km'];
    double? distanceKm;
    if (dist is num) distanceKm = dist.toDouble();
    if (dist is String) distanceKm = double.tryParse(dist);

    return DiscoveryProfile(
      id: (json['id'] ?? '').toString(),
      role: (json['role'] ?? 'listener').toString(),
      displayName: (json['displayName'] ?? json['display_name'])?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      headline: (json['headline'])?.toString(),
      bio: (json['bio'])?.toString(),
      locationRegion: (json['locationRegion'] ?? json['location_region'])?.toString(),
      mentorOptIn: json['mentorOptIn'] == true || json['mentor_opt_in'] == true,
      distanceKm: distanceKm,
    );
  }
}

