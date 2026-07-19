import '../models/notification_models.dart';
import 'api_service.dart';

class NotificationsService {
  final ApiService _api = ApiService();

  Future<List<AppNotification>> getAll({int limit = 50}) async {
    final res = await _api.get('notifications?limit=$limit');
    if (res is! Map<String, dynamic>) return const [];
    final raw = (res['notifications'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => AppNotification.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  Future<int> getUnreadCount() async {
    final res = await _api.get('notifications/unread-count');
    if (res is! Map<String, dynamic>) return 0;
    final value = res['count'];
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  Future<void> markAsRead(String id) async {
    await _api.patch('notifications/$id/read', {});
  }

  Future<void> markAllAsRead() async {
    await _api.post('notifications/mark-all-read', {});
  }

  Future<void> deleteOne(String id) async {
    await _api.delete('notifications/$id');
  }

  Future<void> deleteAll() async {
    await _api.delete('notifications');
  }
}
