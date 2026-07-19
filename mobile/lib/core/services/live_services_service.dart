import 'api_service.dart';

class LiveServiceItem {
  LiveServiceItem({
    required this.id,
    required this.title,
    this.description,
    this.scheduledAt,
    this.linkOrPlace,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String? description;
  final String? scheduledAt;
  final String? linkOrPlace;
  final String createdAt;

  factory LiveServiceItem.fromJson(Map<String, dynamic> json) {
    return LiveServiceItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String?,
      scheduledAt: json['scheduledAt'] as String?,
      linkOrPlace: json['linkOrPlace'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class LiveServicesService {
  final ApiService _api = ApiService();

  Future<List<LiveServiceItem>> listMine() async {
    final res = await _api.get('live-services');
    if (res is! List) return [];
    return res
        .whereType<Map>()
        .map((e) => LiveServiceItem.fromJson(
              Map<String, dynamic>.from(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ),
            ))
        .toList();
  }

  Future<void> create({
    required String title,
    String? description,
    String? scheduledAt,
    String? linkOrPlace,
  }) async {
    await _api.post('live-services', {
      'title': title,
      if (description != null && description.isNotEmpty) 'description': description,
      if (scheduledAt != null && scheduledAt.isNotEmpty) 'scheduledAt': scheduledAt,
      if (linkOrPlace != null && linkOrPlace.isNotEmpty) 'linkOrPlace': linkOrPlace,
    });
  }

  Future<void> delete(String id) async {
    await _api.delete('live-services/$id');
  }

  Future<void> submitSupport({
    required String message,
    required String discordLink,
  }) async {
    await _api.post('live-services/support', {
      'message': message,
      'discordLink': discordLink,
    });
  }
}
