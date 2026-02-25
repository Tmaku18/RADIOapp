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
}

