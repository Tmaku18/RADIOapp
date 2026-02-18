class ServiceProviderProfile {
  final String userId;
  final String? displayName;
  final String? avatarUrl;
  final String? bio;
  final String? locationRegion;

  final String? heroImageUrl;
  final String? instagramUrl;
  final String? linkedinUrl;
  final String? portfolioUrl;
  final bool mentorOptIn;

  final List<ServiceListing> listings;
  final List<ProviderPortfolioItem> portfolio;

  const ServiceProviderProfile({
    required this.userId,
    this.displayName,
    this.avatarUrl,
    this.bio,
    this.locationRegion,
    this.heroImageUrl,
    this.instagramUrl,
    this.linkedinUrl,
    this.portfolioUrl,
    this.mentorOptIn = false,
    this.listings = const [],
    this.portfolio = const [],
  });

  factory ServiceProviderProfile.fromJson(Map<String, dynamic> json) {
    final listingsRaw = json['listings'];
    final portfolioRaw = json['portfolio'];

    final listings = <ServiceListing>[];
    if (listingsRaw is List) {
      for (final item in listingsRaw) {
        if (item is Map) {
          listings.add(ServiceListing.fromJson(item.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }

    final portfolio = <ProviderPortfolioItem>[];
    if (portfolioRaw is List) {
      for (final item in portfolioRaw) {
        if (item is Map) {
          portfolio.add(ProviderPortfolioItem.fromJson(item.map((k, v) => MapEntry(k.toString(), v))));
        }
      }
    }

    return ServiceProviderProfile(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      displayName: (json['displayName'] ?? json['display_name'])?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      bio: (json['bio'])?.toString(),
      locationRegion: (json['locationRegion'] ?? json['location_region'])?.toString(),
      heroImageUrl: (json['heroImageUrl'] ?? json['hero_image_url'])?.toString(),
      instagramUrl: (json['instagramUrl'] ?? json['instagram_url'])?.toString(),
      linkedinUrl: (json['linkedinUrl'] ?? json['linkedin_url'])?.toString(),
      portfolioUrl: (json['portfolioUrl'] ?? json['portfolio_url'])?.toString(),
      mentorOptIn: json['mentorOptIn'] == true || json['mentor_opt_in'] == true,
      listings: listings,
      portfolio: portfolio,
    );
  }
}

class ServiceListing {
  final String id;
  final String serviceType;
  final String title;
  final String? description;
  final int? rateCents;
  final String rateType;

  const ServiceListing({
    required this.id,
    required this.serviceType,
    required this.title,
    this.description,
    this.rateCents,
    required this.rateType,
  });

  factory ServiceListing.fromJson(Map<String, dynamic> json) {
    final rate = json['rateCents'] ?? json['rate_cents'];
    int? rateCents;
    if (rate is num) rateCents = rate.toInt();
    if (rate is String) rateCents = int.tryParse(rate);

    return ServiceListing(
      id: (json['id'] ?? '').toString(),
      serviceType: (json['serviceType'] ?? json['service_type'] ?? 'other').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'])?.toString(),
      rateCents: rateCents,
      rateType: (json['rateType'] ?? json['rate_type'] ?? 'fixed').toString(),
    );
  }
}

class ProviderPortfolioItem {
  final String id;
  final String type; // image|audio|video
  final String fileUrl;
  final String? title;
  final String? description;

  const ProviderPortfolioItem({
    required this.id,
    required this.type,
    required this.fileUrl,
    this.title,
    this.description,
  });

  factory ProviderPortfolioItem.fromJson(Map<String, dynamic> json) {
    return ProviderPortfolioItem(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'image').toString(),
      fileUrl: (json['fileUrl'] ?? json['file_url'] ?? '').toString(),
      title: (json['title'])?.toString(),
      description: (json['description'])?.toString(),
    );
  }
}

