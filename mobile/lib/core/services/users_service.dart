import 'api_service.dart';

class UsersService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.get('users/me');
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to load user profile');
  }

  Future<Map<String, dynamic>> updateMe({bool? discoverable}) async {
    final res = await _api.put('users/me', {
      if (discoverable != null) 'discoverable': discoverable,
    });
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to update user profile');
  }

  Future<Map<String, dynamic>> getArtistLikeNotificationSettings() async {
    final res = await _api.get('users/me/artist-like-notifications');
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to load artist like notification settings');
  }

  Future<Map<String, dynamic>> updateArtistLikeNotificationSettings({
    bool? muted,
    int? minLikesTrigger,
    int? cooldownMinutes,
  }) async {
    final res = await _api.put('users/me/artist-like-notifications', {
      if (muted != null) 'muted': muted,
      if (minLikesTrigger != null) 'minLikesTrigger': minLikesTrigger,
      if (cooldownMinutes != null) 'cooldownMinutes': cooldownMinutes,
    });
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to update artist like notification settings');
  }
}

