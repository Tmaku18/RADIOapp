int? _asInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v?.toString() ?? '');
}

List<String> _asStringList(dynamic v) {
  if (v is! List) return const [];
  return v
      .map((e) => e?.toString().trim() ?? '')
      .where((e) => e.isNotEmpty)
      .toList();
}

class StudioRate {
  const StudioRate({
    required this.id,
    required this.label,
    required this.priceCents,
    required this.unit,
    this.notes,
    this.sortOrder = 0,
  });

  final String id;
  final String label;
  final int priceCents;
  final String unit;
  final String? notes;
  final int sortOrder;

  factory StudioRate.fromJson(Map<String, dynamic> json) {
    return StudioRate(
      id: (json['id'] ?? '').toString(),
      label: (json['label'] ?? '').toString(),
      priceCents: _asInt(json['priceCents'] ?? json['price_cents']) ?? 0,
      unit: (json['unit'] ?? 'hour').toString(),
      notes: json['notes']?.toString(),
      sortOrder: _asInt(json['sortOrder'] ?? json['sort_order']) ?? 0,
    );
  }

  Map<String, dynamic> toPayload() => {
        if (id.isNotEmpty) 'id': id,
        'label': label,
        'priceCents': priceCents,
        'unit': unit,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes,
      };

  String get formattedPrice {
    final dollars = (priceCents / 100).toStringAsFixed(
      priceCents % 100 == 0 ? 0 : 2,
    );
    return '\$$dollars${unitSuffix(unit)}';
  }

  static String unitSuffix(String unit) {
    switch (unit) {
      case 'day':
        return '/day';
      case 'half_day':
        return '/half day';
      case 'session':
        return '/session';
      default:
        return '/hr';
    }
  }

  static String unitLabel(String unit) {
    switch (unit) {
      case 'day':
        return 'Day';
      case 'half_day':
        return 'Half day';
      case 'session':
        return 'Session';
      default:
        return 'Hour';
    }
  }
}

class StudioHour {
  const StudioHour({
    required this.day,
    this.open,
    this.close,
    this.closed = false,
  });

  final String day;
  final String? open;
  final String? close;
  final bool closed;

  Map<String, dynamic> toPayload() => {
        'day': day,
        'open': open,
        'close': close,
        'closed': closed,
      };

  factory StudioHour.fromJson(Map<String, dynamic> json) {
    return StudioHour(
      day: (json['day'] ?? '').toString(),
      open: json['open']?.toString(),
      close: json['close']?.toString(),
      closed: json['closed'] == true,
    );
  }
}

class StudioMember {
  const StudioMember({
    required this.userId,
    this.displayName,
    this.avatarUrl,
    this.role,
    this.headline,
    this.title,
  });

  final String userId;
  final String? displayName;
  final String? avatarUrl;
  final String? role;
  final String? headline;
  final String? title;

  factory StudioMember.fromJson(Map<String, dynamic> json) {
    return StudioMember(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      displayName: json['displayName']?.toString() ??
          json['display_name']?.toString(),
      avatarUrl:
          json['avatarUrl']?.toString() ?? json['avatar_url']?.toString(),
      role: json['role']?.toString(),
      headline: json['headline']?.toString(),
      title: json['title']?.toString(),
    );
  }
}

class Studio {
  const Studio({
    required this.id,
    required this.ownerUserId,
    required this.name,
    this.ownerDisplayName,
    this.tagline,
    this.about,
    this.heroImageUrl,
    this.photos = const [],
    this.amenities = const [],
    this.hours = const [],
    this.hoursSummary,
    this.members = const [],
    this.city,
    this.state,
    this.zipCode,
    this.country,
    this.addressLine1,
    this.addressLine2,
    this.lat,
    this.lng,
    this.vicinityRadiusKm,
    this.locationPrecision = 'approximate',
    this.startingAtCents,
    this.startingAtUnit,
    this.bookingLink,
    this.contactEmail,
    this.contactPhone,
    this.contactLocked = false,
    this.isPublished = true,
    this.rates = const [],
    this.distanceKm,
  });

  final String id;
  final String ownerUserId;
  final String? ownerDisplayName;
  final String name;
  final String? tagline;
  final String? about;
  final String? heroImageUrl;
  final List<String> photos;
  final List<String> amenities;
  final List<StudioHour> hours;
  final String? hoursSummary;
  final List<StudioMember> members;
  final String? city;
  final String? state;
  final String? zipCode;
  final String? country;
  final String? addressLine1;
  final String? addressLine2;
  final double? lat;
  final double? lng;
  final double? vicinityRadiusKm;
  final String locationPrecision;
  final int? startingAtCents;
  final String? startingAtUnit;
  final String? bookingLink;
  final String? contactEmail;
  final String? contactPhone;
  final bool contactLocked;
  final bool isPublished;
  final List<StudioRate> rates;
  final double? distanceKm;

  bool get isExact => locationPrecision == 'exact';

  String? get startingAtLabel {
    if (startingAtCents == null) return null;
    final dollars = (startingAtCents! / 100).toStringAsFixed(
      startingAtCents! % 100 == 0 ? 0 : 2,
    );
    return 'Starting at \$$dollars${StudioRate.unitSuffix(startingAtUnit ?? 'hour')}';
  }

  String get locationLine {
    final bits = <String>[
      if ((addressLine1 ?? '').trim().isNotEmpty) addressLine1!.trim(),
      if ((city ?? '').trim().isNotEmpty) city!.trim(),
      if ((state ?? '').trim().isNotEmpty) state!.trim(),
      if ((zipCode ?? '').trim().isNotEmpty) zipCode!.trim(),
    ];
    return bits.join(', ');
  }

  factory Studio.fromJson(Map<String, dynamic> json) {
    final ratesRaw = json['rates'];
    return Studio(
      id: (json['id'] ?? '').toString(),
      ownerUserId: (json['ownerUserId'] ?? json['owner_user_id'] ?? '')
          .toString(),
      ownerDisplayName:
          json['ownerDisplayName']?.toString() ??
          json['owner_display_name']?.toString(),
      name: (json['name'] ?? json['displayName'] ?? 'Studio').toString(),
      tagline: json['tagline']?.toString() ?? json['headline']?.toString(),
      about: json['about']?.toString(),
      heroImageUrl:
          json['heroImageUrl']?.toString() ?? json['hero_image_url']?.toString(),
      photos: _asStringList(json['photos']),
      amenities: _asStringList(json['amenities']),
      hours: (json['hours'] is List)
          ? (json['hours'] as List)
              .whereType<Map>()
              .map((e) => StudioHour.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      hoursSummary: json['hoursSummary']?.toString() ??
          json['hours_summary']?.toString(),
      members: (json['members'] is List)
          ? (json['members'] as List)
              .whereType<Map>()
              .map((e) => StudioMember.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      city: json['city']?.toString(),
      state: json['state']?.toString(),
      zipCode: json['zipCode']?.toString() ?? json['zip_code']?.toString(),
      country: json['country']?.toString(),
      addressLine1:
          json['addressLine1']?.toString() ??
          json['address_line1']?.toString(),
      addressLine2:
          json['addressLine2']?.toString() ??
          json['address_line2']?.toString(),
      lat: (json['lat'] is num) ? (json['lat'] as num).toDouble() : null,
      lng: (json['lng'] is num) ? (json['lng'] as num).toDouble() : null,
      vicinityRadiusKm: (json['vicinityRadiusKm'] is num)
          ? (json['vicinityRadiusKm'] as num).toDouble()
          : null,
      locationPrecision:
          (json['locationPrecision'] ??
                  json['location_precision'] ??
                  'approximate')
              .toString(),
      startingAtCents: _asInt(
        json['startingAtCents'] ?? json['starting_at_cents'],
      ),
      startingAtUnit:
          json['startingAtUnit']?.toString() ??
          json['starting_at_unit']?.toString(),
      bookingLink:
          json['bookingLink']?.toString() ?? json['booking_link']?.toString(),
      contactEmail:
          json['contactEmail']?.toString() ??
          json['contact_email']?.toString(),
      contactPhone:
          json['contactPhone']?.toString() ??
          json['contact_phone']?.toString(),
      contactLocked: json['contactLocked'] == true ||
          json['contact_locked'] == true,
      isPublished: json['isPublished'] != false && json['is_published'] != false,
      rates: ratesRaw is List
          ? ratesRaw
                .whereType<Map>()
                .map((e) => StudioRate.fromJson(Map<String, dynamic>.from(e)))
                .toList()
          : const [],
      distanceKm: (json['distanceKm'] is num)
          ? (json['distanceKm'] as num).toDouble()
          : null,
    );
  }
}
