import 'dart:io';
import 'api_service.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/follow_models.dart';

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
    String? displayName,
    String? region,
    bool? suggestLocalArtists,
    String? bio,
    String? headline,
    String? locationRegion,
    String? instagramUrl,
    String? twitterUrl,
    String? youtubeUrl,
    String? tiktokUrl,
    String? websiteUrl,
    String? soundcloudUrl,
    String? spotifyUrl,
    String? appleMusicUrl,
    String? facebookUrl,
    String? snapchatUrl,
    String? role,
  }) async {
    final res = await _api.put('users/me', {
      if (discoverable != null) 'discoverable': discoverable,
      if (avatarUrl != null) 'avatarUrl': avatarUrl,
      if (displayName != null) 'displayName': displayName,
      if (region != null) 'region': region,
      if (suggestLocalArtists != null) 'suggestLocalArtists': suggestLocalArtists,
      if (bio != null) 'bio': bio,
      if (headline != null) 'headline': headline,
      if (locationRegion != null) 'locationRegion': locationRegion,
      if (instagramUrl != null) 'instagramUrl': instagramUrl,
      if (twitterUrl != null) 'twitterUrl': twitterUrl,
      if (youtubeUrl != null) 'youtubeUrl': youtubeUrl,
      if (tiktokUrl != null) 'tiktokUrl': tiktokUrl,
      if (websiteUrl != null) 'websiteUrl': websiteUrl,
      if (soundcloudUrl != null) 'soundcloudUrl': soundcloudUrl,
      if (spotifyUrl != null) 'spotifyUrl': spotifyUrl,
      if (appleMusicUrl != null) 'appleMusicUrl': appleMusicUrl,
      if (facebookUrl != null) 'facebookUrl': facebookUrl,
      if (snapchatUrl != null) 'snapchatUrl': snapchatUrl,
      if (role != null) 'role': role,
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

  Future<Map<String, int>> getFollowCounts(String userId) async {
    final res = await _api.get('users/$userId/follow-counts');
    if (res is! Map<String, dynamic>) {
      return {'followers': 0, 'following': 0};
    }
    int asInt(dynamic value) => value is int
        ? value
        : int.tryParse(value?.toString() ?? '') ?? 0;
    return {
      'followers': asInt(res['followers']),
      'following': asInt(res['following']),
    };
  }

  Future<List<FollowListItem>> getFollowers(
    String userId, {
    int limit = 100,
    int offset = 0,
  }) async {
    final res = await _api.get(
      'users/$userId/followers?limit=$limit&offset=$offset',
    );
    if (res is! Map<String, dynamic>) return const [];
    final raw = (res['items'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => FollowListItem.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  Future<List<FollowListItem>> getFollowing(
    String userId, {
    int limit = 100,
    int offset = 0,
  }) async {
    final res = await _api.get(
      'users/$userId/following?limit=$limit&offset=$offset',
    );
    if (res is! Map<String, dynamic>) return const [];
    final raw = (res['items'] as List?) ?? const [];
    return raw
        .whereType<Map>()
        .map(
          (e) => FollowListItem.fromJson(
            e.map((k, v) => MapEntry(k.toString(), v)),
          ),
        )
        .toList();
  }

  Future<bool> isFollowing(String userId) async {
    final res = await _api.get('users/$userId/follow');
    if (res is! Map<String, dynamic>) return false;
    return res['following'] == true;
  }

  Future<void> follow(String userId) async {
    await _api.post('users/$userId/follow', {});
  }

  Future<void> unfollow(String userId) async {
    await _api.delete('users/$userId/follow');
  }
}

