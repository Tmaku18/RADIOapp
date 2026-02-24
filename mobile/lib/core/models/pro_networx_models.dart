class ProSkill {
  final String name;
  final String category;
  const ProSkill({required this.name, required this.category});

  factory ProSkill.fromJson(Map<String, dynamic> json) {
    return ProSkill(
      name: (json['name'] ?? '').toString(),
      category: (json['category'] ?? 'general').toString(),
    );
  }
}

class ProProfile {
  final String userId;
  final bool availableForWork;
  final String? skillsHeadline;
  final List<ProSkill> skills;

  const ProProfile({
    required this.userId,
    required this.availableForWork,
    required this.skillsHeadline,
    required this.skills,
  });

  factory ProProfile.fromJson(Map<String, dynamic> json) {
    final skillsRaw = json['skills'];
    final skills = <ProSkill>[];
    if (skillsRaw is List) {
      for (final s in skillsRaw) {
        if (s is Map) {
          skills.add(ProSkill.fromJson(s.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }
    return ProProfile(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      availableForWork: json['availableForWork'] == true || json['available_for_work'] == true,
      skillsHeadline: (json['skillsHeadline'] ?? json['skills_headline'])?.toString(),
      skills: skills,
    );
  }
}

class ProDirectoryItem {
  final String userId;
  final String? role;
  final String? displayName;
  final String? avatarUrl;
  final String? headline;
  final String? bio;
  final String? locationRegion;
  final bool availableForWork;
  final String? skillsHeadline;
  final List<String> skills;
  final String? serviceTitle;
  final String? mediaPreviewUrl;
  final String? mediaPreviewType;
  final int? startingAtCents;
  final String? startingAtRateType;
  final bool verifiedCatalyst;
  final bool mentorOptIn;

  const ProDirectoryItem({
    required this.userId,
    required this.role,
    required this.displayName,
    required this.avatarUrl,
    required this.headline,
    required this.bio,
    required this.locationRegion,
    required this.availableForWork,
    required this.skillsHeadline,
    required this.skills,
    required this.serviceTitle,
    required this.mediaPreviewUrl,
    required this.mediaPreviewType,
    required this.startingAtCents,
    required this.startingAtRateType,
    required this.verifiedCatalyst,
    required this.mentorOptIn,
  });

  factory ProDirectoryItem.fromJson(Map<String, dynamic> json) {
    final skillsRaw = json['skills'];
    final skills = <String>[];
    if (skillsRaw is List) {
      for (final s in skillsRaw) {
        if (s == null) continue;
        skills.add(s.toString());
      }
    }
    return ProDirectoryItem(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      role: (json['role'])?.toString(),
      displayName: (json['displayName'] ?? json['display_name'])?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      headline: (json['headline'])?.toString(),
      bio: (json['bio'])?.toString(),
      locationRegion: (json['locationRegion'] ?? json['location_region'])?.toString(),
      availableForWork: json['availableForWork'] == true || json['available_for_work'] == true,
      skillsHeadline: (json['skillsHeadline'] ?? json['skills_headline'])?.toString(),
      skills: skills,
      serviceTitle: (json['serviceTitle'] ?? json['service_title'])?.toString(),
      mediaPreviewUrl: (json['mediaPreviewUrl'] ?? json['media_preview_url'])?.toString(),
      mediaPreviewType: (json['mediaPreviewType'] ?? json['media_preview_type'])?.toString(),
      startingAtCents: (json['startingAtCents'] ?? json['starting_at_cents']) is int
          ? (json['startingAtCents'] ?? json['starting_at_cents']) as int
          : int.tryParse((json['startingAtCents'] ?? json['starting_at_cents'] ?? '').toString()),
      startingAtRateType: (json['startingAtRateType'] ?? json['starting_at_rate_type'])?.toString(),
      verifiedCatalyst: json['verifiedCatalyst'] == true || json['verified_catalyst'] == true,
      mentorOptIn: json['mentorOptIn'] == true || json['mentor_opt_in'] == true,
    );
  }
}

