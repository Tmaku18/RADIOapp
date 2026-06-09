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

class ProExperienceItem {
  String title;
  String company;
  String location;
  String startDate;
  String endDate;
  bool current;
  String description;

  ProExperienceItem({
    this.title = '',
    this.company = '',
    this.location = '',
    this.startDate = '',
    this.endDate = '',
    this.current = false,
    this.description = '',
  });

  factory ProExperienceItem.fromJson(Map<String, dynamic> json) {
    return ProExperienceItem(
      title: (json['title'] ?? '').toString(),
      company: (json['company'] ?? '').toString(),
      location: (json['location'] ?? '').toString(),
      startDate: (json['startDate'] ?? json['start_date'] ?? '').toString(),
      endDate: (json['endDate'] ?? json['end_date'] ?? '').toString(),
      current: json['current'] == true,
      description: (json['description'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'title': title.trim(),
        'company': company.trim(),
        if (location.trim().isNotEmpty) 'location': location.trim(),
        if (startDate.trim().isNotEmpty) 'startDate': startDate.trim(),
        if (endDate.trim().isNotEmpty) 'endDate': endDate.trim(),
        'current': current,
        if (description.trim().isNotEmpty) 'description': description.trim(),
      };
}

class ProEducationItem {
  String school;
  String degree;
  String field;
  String startYear;
  String endYear;
  String description;

  ProEducationItem({
    this.school = '',
    this.degree = '',
    this.field = '',
    this.startYear = '',
    this.endYear = '',
    this.description = '',
  });

  factory ProEducationItem.fromJson(Map<String, dynamic> json) {
    return ProEducationItem(
      school: (json['school'] ?? '').toString(),
      degree: (json['degree'] ?? '').toString(),
      field: (json['field'] ?? '').toString(),
      startYear: (json['startYear'] ?? json['start_year'] ?? '').toString(),
      endYear: (json['endYear'] ?? json['end_year'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'school': school.trim(),
        if (degree.trim().isNotEmpty) 'degree': degree.trim(),
        if (field.trim().isNotEmpty) 'field': field.trim(),
        if (startYear.trim().isNotEmpty) 'startYear': startYear.trim(),
        if (endYear.trim().isNotEmpty) 'endYear': endYear.trim(),
        if (description.trim().isNotEmpty) 'description': description.trim(),
      };
}

class ProFeaturedItem {
  String type;
  String url;
  String title;
  String description;

  ProFeaturedItem({
    this.type = 'link',
    this.url = '',
    this.title = '',
    this.description = '',
  });

  factory ProFeaturedItem.fromJson(Map<String, dynamic> json) {
    return ProFeaturedItem(
      type: (json['type'] ?? 'link').toString(),
      url: (json['url'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'type': type.trim().isEmpty ? 'link' : type.trim(),
        if (url.trim().isNotEmpty) 'url': url.trim(),
        if (title.trim().isNotEmpty) 'title': title.trim(),
        if (description.trim().isNotEmpty) 'description': description.trim(),
      };
}

class ProProfile {
  final String userId;
  final bool availableForWork;
  final String? skillsHeadline;
  final String? currentTitle;
  final String? about;
  final String? avatarUrl;
  final String? heroImageUrl;
  final String? websiteUrl;
  final String? instagramUrl;
  final String? twitterUrl;
  final String? youtubeUrl;
  final String? tiktokUrl;
  final String? soundcloudUrl;
  final String? spotifyUrl;
  final String? appleMusicUrl;
  final String? facebookUrl;
  final String? snapchatUrl;
  final List<ProSkill> skills;
  final List<ProExperienceItem> experience;
  final List<ProEducationItem> education;
  final List<ProFeaturedItem> featured;

  const ProProfile({
    required this.userId,
    required this.availableForWork,
    required this.skillsHeadline,
    required this.currentTitle,
    required this.about,
    required this.avatarUrl,
    required this.heroImageUrl,
    required this.websiteUrl,
    required this.instagramUrl,
    required this.twitterUrl,
    required this.youtubeUrl,
    required this.tiktokUrl,
    required this.soundcloudUrl,
    required this.spotifyUrl,
    required this.appleMusicUrl,
    required this.facebookUrl,
    required this.snapchatUrl,
    required this.skills,
    required this.experience,
    required this.education,
    required this.featured,
  });

  static List<T> _parseList<T>(
    dynamic raw,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
        .toList();
  }

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
      currentTitle: (json['currentTitle'] ?? json['current_title'])?.toString(),
      about: (json['about'])?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      heroImageUrl: (json['heroImageUrl'] ?? json['hero_image_url'])?.toString(),
      websiteUrl: (json['websiteUrl'] ?? json['website_url'])?.toString(),
      instagramUrl: (json['instagramUrl'] ?? json['instagram_url'])?.toString(),
      twitterUrl: (json['twitterUrl'] ?? json['twitter_url'])?.toString(),
      youtubeUrl: (json['youtubeUrl'] ?? json['youtube_url'])?.toString(),
      tiktokUrl: (json['tiktokUrl'] ?? json['tiktok_url'])?.toString(),
      soundcloudUrl: (json['soundcloudUrl'] ?? json['soundcloud_url'])?.toString(),
      spotifyUrl: (json['spotifyUrl'] ?? json['spotify_url'])?.toString(),
      appleMusicUrl: (json['appleMusicUrl'] ?? json['apple_music_url'])?.toString(),
      facebookUrl: (json['facebookUrl'] ?? json['facebook_url'])?.toString(),
      snapchatUrl: (json['snapchatUrl'] ?? json['snapchat_url'])?.toString(),
      skills: skills,
      experience: _parseList(json['experience'], ProExperienceItem.fromJson),
      education: _parseList(json['education'], ProEducationItem.fromJson),
      featured: _parseList(json['featured'], ProFeaturedItem.fromJson),
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

class ProFeedPost {
  final String id;
  final String authorUserId;
  final String? authorDisplayName;
  final String? authorUsername;
  final String? authorAvatarUrl;
  final String? authorHeadline;
  final String imageUrl;
  final String mediaType;
  final String? caption;
  final String createdAt;
  int likeCount;
  int commentCount;
  bool likedByMe;
  bool bookmarkedByMe;

  ProFeedPost({
    required this.id,
    required this.authorUserId,
    required this.authorDisplayName,
    this.authorUsername,
    required this.authorAvatarUrl,
    required this.authorHeadline,
    required this.imageUrl,
    required this.mediaType,
    required this.caption,
    required this.createdAt,
    required this.likeCount,
    required this.commentCount,
    required this.likedByMe,
    this.bookmarkedByMe = false,
  });

  factory ProFeedPost.fromJson(Map<String, dynamic> json) {
    return ProFeedPost(
      id: (json['id'] ?? '').toString(),
      authorUserId: (json['authorUserId'] ?? '').toString(),
      authorDisplayName: (json['authorDisplayName'])?.toString(),
      authorUsername: (json['authorUsername'])?.toString(),
      authorAvatarUrl: (json['authorAvatarUrl'])?.toString(),
      authorHeadline: (json['authorHeadline'])?.toString(),
      imageUrl: (json['imageUrl'] ?? '').toString(),
      mediaType: (json['mediaType'] ?? 'image').toString(),
      caption: (json['caption'])?.toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
      likeCount: (json['likeCount'] is int)
          ? json['likeCount'] as int
          : int.tryParse((json['likeCount'] ?? '0').toString()) ?? 0,
      commentCount: (json['commentCount'] is int)
          ? json['commentCount'] as int
          : int.tryParse((json['commentCount'] ?? '0').toString()) ?? 0,
      likedByMe: json['likedByMe'] == true,
      bookmarkedByMe: json['bookmarkedByMe'] == true,
    );
  }
}

class ProFeedComment {
  final String id;
  final String postId;
  final String authorUserId;
  final String? authorDisplayName;
  final String? authorAvatarUrl;
  final String body;
  final String createdAt;

  const ProFeedComment({
    required this.id,
    required this.postId,
    required this.authorUserId,
    required this.authorDisplayName,
    required this.authorAvatarUrl,
    required this.body,
    required this.createdAt,
  });

  factory ProFeedComment.fromJson(Map<String, dynamic> json) {
    return ProFeedComment(
      id: (json['id'] ?? '').toString(),
      postId: (json['postId'] ?? '').toString(),
      authorUserId: (json['authorUserId'] ?? '').toString(),
      authorDisplayName: (json['authorDisplayName'])?.toString(),
      authorAvatarUrl: (json['authorAvatarUrl'])?.toString(),
      body: (json['body'] ?? '').toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
    );
  }
}

class ProSearchPerson {
  final String userId;
  final String? displayName;
  final String? avatarUrl;
  final String? headline;
  final String? role;

  const ProSearchPerson({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
    required this.headline,
    required this.role,
  });

  factory ProSearchPerson.fromJson(Map<String, dynamic> json) {
    return ProSearchPerson(
      userId: (json['userId'] ?? '').toString(),
      displayName: (json['displayName'])?.toString(),
      avatarUrl: (json['avatarUrl'])?.toString(),
      headline: (json['headline'])?.toString(),
      role: (json['role'])?.toString(),
    );
  }
}

class ProSearchResult {
  final List<ProSearchPerson> people;
  final List<ProFeedPost> posts;

  const ProSearchResult({required this.people, required this.posts});

  factory ProSearchResult.fromJson(Map<String, dynamic> json) {
    final people = <ProSearchPerson>[];
    final posts = <ProFeedPost>[];
    final p = json['people'];
    final ps = json['posts'];
    if (p is List) {
      for (final item in p) {
        if (item is Map) {
          people.add(ProSearchPerson.fromJson(
              item.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }
    if (ps is List) {
      for (final item in ps) {
        if (item is Map) {
          posts.add(ProFeedPost.fromJson(
              item.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }
    return ProSearchResult(people: people, posts: posts);
  }
}

class ProServiceContact {
  final String? email;
  final String? phone;
  final String? link;
  const ProServiceContact({this.email, this.phone, this.link});

  factory ProServiceContact.fromJson(Map<String, dynamic> json) {
    return ProServiceContact(
      email: (json['email'])?.toString(),
      phone: (json['phone'])?.toString(),
      link: (json['link'])?.toString(),
    );
  }
}

class ProServiceListing {
  final String id;
  final String ownerUserId;
  final String? ownerDisplayName;
  final String? ownerAvatarUrl;
  final String? ownerHeadline;
  final String serviceType;
  final String title;
  final String? description;
  final int? priceCents;
  final String rateType;
  final String currency;
  final String status;
  final bool isPublished;
  final String createdAt;
  final String updatedAt;
  final ProServiceContact? contact;

  const ProServiceListing({
    required this.id,
    required this.ownerUserId,
    required this.ownerDisplayName,
    required this.ownerAvatarUrl,
    required this.ownerHeadline,
    required this.serviceType,
    required this.title,
    required this.description,
    required this.priceCents,
    required this.rateType,
    required this.currency,
    required this.status,
    required this.isPublished,
    required this.createdAt,
    required this.updatedAt,
    required this.contact,
  });

  factory ProServiceListing.fromJson(Map<String, dynamic> json) {
    final contactRaw = json['contact'];
    return ProServiceListing(
      id: (json['id'] ?? '').toString(),
      ownerUserId: (json['ownerUserId'] ?? '').toString(),
      ownerDisplayName: (json['ownerDisplayName'])?.toString(),
      ownerAvatarUrl: (json['ownerAvatarUrl'])?.toString(),
      ownerHeadline: (json['ownerHeadline'])?.toString(),
      serviceType: (json['serviceType'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'])?.toString(),
      priceCents: (json['priceCents'] is int)
          ? json['priceCents'] as int
          : int.tryParse((json['priceCents'] ?? '').toString()),
      rateType: (json['rateType'] ?? 'fixed').toString(),
      currency: (json['currency'] ?? 'USD').toString(),
      status: (json['status'] ?? 'active').toString(),
      isPublished: json['isPublished'] != false,
      createdAt: (json['createdAt'] ?? '').toString(),
      updatedAt: (json['updatedAt'] ?? '').toString(),
      contact: contactRaw is Map
          ? ProServiceContact.fromJson(
              contactRaw.map((k, v) => MapEntry(k.toString(), v)),
            )
          : null,
    );
  }
}

class ProNetworkAccess {
  final bool hasAccess;
  final String? status;
  final String? currentPeriodEnd;
  final int regularCents;
  final int introCents;

  const ProNetworkAccess({
    required this.hasAccess,
    required this.status,
    required this.currentPeriodEnd,
    required this.regularCents,
    required this.introCents,
  });

  factory ProNetworkAccess.fromJson(Map<String, dynamic> json) {
    final pricing = json['pricing'];
    int regular = 999;
    int intro = 499;
    if (pricing is Map) {
      regular = (pricing['regularCents'] is int)
          ? pricing['regularCents'] as int
          : int.tryParse((pricing['regularCents'] ?? '999').toString()) ?? 999;
      intro = (pricing['introCents'] is int)
          ? pricing['introCents'] as int
          : int.tryParse((pricing['introCents'] ?? '499').toString()) ?? 499;
    }
    return ProNetworkAccess(
      hasAccess: json['hasAccess'] == true,
      status: (json['status'])?.toString(),
      currentPeriodEnd: (json['currentPeriodEnd'])?.toString(),
      regularCents: regular,
      introCents: intro,
    );
  }
}

