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
    this.discoverable = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    String s(dynamic v) => (v ?? '').toString();
    DateTime dt(dynamic v) => v is DateTime ? v : DateTime.parse(s(v));
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
      'discoverable': discoverable,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
