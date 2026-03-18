import 'dart:io';
import 'api_service.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

class UsersService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getMe() async {
    final res = await _api.get('users/me');
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to load user profile');
  }

  Future<Map<String, dynamic>> updateMe({
    bool? discoverable,
    String? avatarUrl,
  }) async {
    final res = await _api.put('users/me', {
      if (discoverable != null) 'discoverable': discoverable,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
    });
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to update user profile');
  }

  Future<Map<String, dynamic>> uploadAvatar(File file) async {
    String contentType;
    final lowerPath = file.path.toLowerCase();
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (lowerPath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerPath.endsWith('.webp')) {
      contentType = 'image/webp';
    } else {
      throw Exception('Please choose a JPEG, PNG, or WebP image.');
    }

    final parts = contentType.split('/');
    final multipartFile = await http.MultipartFile.fromPath(
      'file',
      file.path,
      contentType: MediaType(parts[0], parts[1]),
    );
    final res = await _api.postMultipart(
      'users/me/avatar',
      const {},
      [multipartFile],
    );
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to upload profile photo');
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

