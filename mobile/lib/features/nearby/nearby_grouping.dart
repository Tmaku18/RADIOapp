/// Pure helpers for Nearby People city / ZIP grouping (API fallback).

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is! List) return const [];
  final out = <Map<String, dynamic>>[];
  for (final e in value) {
    if (e is Map) out.add(Map<String, dynamic>.from(e));
  }
  return out;
}

bool groupsHavePeople(List<Map<String, dynamic>> groups) {
  for (final g in groups) {
    if (asMapList(g['people']).isNotEmpty) return true;
  }
  return false;
}

String personCity(Map<String, dynamic> item) {
  final city = (item['city'] ?? '').toString().trim();
  if (city.isNotEmpty) return city;
  return (item['locationRegion'] ??
          item['location_region'] ??
          item['location'] ??
          '')
      .toString()
      .trim();
}

String personZip(Map<String, dynamic> item) =>
    (item['zipCode'] ?? item['zip_code'] ?? item['zip'] ?? '')
        .toString()
        .trim();

String? personId(Map<String, dynamic> item) {
  final id = (item['userId'] ?? item['user_id'] ?? item['id'] ?? '')
      .toString()
      .trim();
  return id.isEmpty ? null : id;
}

String itemKind(Map<String, dynamic> item) {
  final kind = (item['kind'] ?? 'person').toString().trim().toLowerCase();
  return kind == 'studio' ? 'studio' : 'person';
}

bool isStudioItem(Map<String, dynamic> item) => itemKind(item) == 'studio';

/// Directory row id: studio id for studios, user id for people.
String? directoryItemId(Map<String, dynamic> item) {
  if (isStudioItem(item)) {
    final id = (item['id'] ?? '').toString().trim();
    return id.isEmpty ? null : id;
  }
  return personId(item);
}

List<Map<String, dynamic>> groupNearbyByCity(List<Map<String, dynamic>> items) {
  final map = <String, List<Map<String, dynamic>>>{};
  for (final person in items) {
    final city = personCity(person);
    final key = city.isEmpty ? 'Unknown city' : city;
    (map[key] ??= []).add(person);
  }
  final keys = map.keys.toList()..sort();
  return [
    for (final key in keys)
      {
        'key': 'city:$key',
        'label': key,
        'city': key == 'Unknown city' ? null : key,
        'zipCode': null,
        'count': map[key]!.length,
        'people': map[key],
      },
  ];
}

List<Map<String, dynamic>> groupNearbyByZip(List<Map<String, dynamic>> items) {
  final map = <String, List<Map<String, dynamic>>>{};
  for (final person in items) {
    final zip = personZip(person);
    if (zip.isEmpty) continue;
    (map[zip] ??= []).add(person);
  }
  final keys = map.keys.toList()..sort();
  return [
    for (final key in keys)
      {
        'key': 'zip:$key',
        'label': key,
        'city': personCity(map[key]!.first),
        'zipCode': key,
        'count': map[key]!.length,
        'people': map[key],
      },
  ];
}
