class User {
  final String id;
  final String firebaseUid;
  final String email;
  final String? displayName;
  final String role;
  final String? avatarUrl;
  final String? headline;
  final String? locationRegion;
  final String? bio;
  final String? instagramUrl;
  final String? twitterUrl;
  final String? youtubeUrl;
  final String? tiktokUrl;
  final String? websiteUrl;
  final bool discoverable;
  final DateTime createdAt;
  final DateTime updatedAt;

  User({
    required this.id,
    required this.firebaseUid,
    required this.email,
    this.displayName,
    required this.role,
    this.avatarUrl,
    this.headline,
    this.locationRegion,
    this.bio,
    this.instagramUrl,
    this.twitterUrl,
    this.youtubeUrl,
    this.tiktokUrl,
    this.websiteUrl,
    this.discoverable = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    String s(dynamic v) => (v ?? '').toString();
    DateTime dt(dynamic v) {
      if (v is DateTime) return v;
      if (v == null) return DateTime.now();
      if (v is int) {
        // Accept unix timestamps in either seconds or milliseconds.
        final ms = v < 1000000000000 ? v * 1000 : v;
        return DateTime.fromMillisecondsSinceEpoch(ms, isUtc: true).toLocal();
      }
      if (v is String) {
        final raw = v.trim();
        if (raw.isEmpty) return DateTime.now();
        final parsed = DateTime.tryParse(raw);
        if (parsed != null) return parsed;
      }
      return DateTime.now();
    }
    return User(
      // Support both snake_case (older/mobile) and camelCase (current backend).
      id: s(json['id']),
      firebaseUid: s(json['firebase_uid'] ?? json['firebaseUid']),
      email: s(json['email']),
      displayName: (json['display_name'] ?? json['displayName'])?.toString(),
      role: s(json['role']),
      avatarUrl: (json['avatar_url'] ?? json['avatarUrl'])?.toString(),
      headline: (json['headline'])?.toString(),
      locationRegion: (json['location_region'] ?? json['locationRegion'])?.toString(),
      bio: (json['bio'])?.toString(),
      instagramUrl:
          (json['instagram_url'] ?? json['instagramUrl'])?.toString(),
      twitterUrl: (json['twitter_url'] ?? json['twitterUrl'])?.toString(),
      youtubeUrl: (json['youtube_url'] ?? json['youtubeUrl'])?.toString(),
      tiktokUrl: (json['tiktok_url'] ?? json['tiktokUrl'])?.toString(),
      websiteUrl: (json['website_url'] ?? json['websiteUrl'])?.toString(),
      discoverable: (json['discoverable'] ?? true) == true,
      createdAt: dt(json['created_at'] ?? json['createdAt']),
      updatedAt: dt(json['updated_at'] ?? json['updatedAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'firebaseUid': firebaseUid,
      'email': email,
      'displayName': displayName,
      'role': role,
      'avatarUrl': avatarUrl,
      'headline': headline,
      'locationRegion': locationRegion,
      'bio': bio,
      'instagramUrl': instagramUrl,
      'twitterUrl': twitterUrl,
      'youtubeUrl': youtubeUrl,
      'tiktokUrl': tiktokUrl,
      'websiteUrl': websiteUrl,
      'discoverable': discoverable,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
