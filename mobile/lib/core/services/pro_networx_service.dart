import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/pro_networx_models.dart';
import 'api_service.dart';

class ProNetworxService {
  final ApiService _api = ApiService();

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------
  Future<ProProfile> getMeProfile() async {
    final res = await _api.get('pro-networx/me/profile');
    if (res is Map<String, dynamic>) return ProProfile.fromJson(res);
    throw Exception('Failed to load Pro profile');
  }

  Future<ProProfile> updateMeProfile({
    bool? availableForWork,
    String? skillsHeadline,
    String? currentTitle,
    String? about,
    String? websiteUrl,
    String? instagramUrl,
    String? twitterUrl,
    String? youtubeUrl,
    String? tiktokUrl,
    String? soundcloudUrl,
    String? spotifyUrl,
    String? appleMusicUrl,
    String? facebookUrl,
    String? snapchatUrl,
    List<String>? skillNames,
    List<Map<String, dynamic>>? experience,
    List<Map<String, dynamic>>? education,
    List<Map<String, dynamic>>? featured,
  }) async {
    final res = await _api.put('pro-networx/me/profile', {
      if (availableForWork != null) 'availableForWork': availableForWork,
      if (skillsHeadline != null) 'skillsHeadline': skillsHeadline,
      if (currentTitle != null) 'currentTitle': currentTitle,
      if (about != null) 'about': about,
      if (websiteUrl != null) 'websiteUrl': websiteUrl,
      if (instagramUrl != null) 'instagramUrl': instagramUrl,
      if (twitterUrl != null) 'twitterUrl': twitterUrl,
      if (youtubeUrl != null) 'youtubeUrl': youtubeUrl,
      if (tiktokUrl != null) 'tiktokUrl': tiktokUrl,
      if (soundcloudUrl != null) 'soundcloudUrl': soundcloudUrl,
      if (spotifyUrl != null) 'spotifyUrl': spotifyUrl,
      if (appleMusicUrl != null) 'appleMusicUrl': appleMusicUrl,
      if (facebookUrl != null) 'facebookUrl': facebookUrl,
      if (snapchatUrl != null) 'snapchatUrl': snapchatUrl,
      if (skillNames != null) 'skillNames': skillNames,
      if (experience != null) 'experience': experience,
      if (education != null) 'education': education,
      if (featured != null) 'featured': featured,
    });
    if (res is Map<String, dynamic>) return ProProfile.fromJson(res);
    throw Exception('Failed to update Pro profile');
  }

  Future<List<ProDirectoryItem>> listDirectory({
    String? skill,
    bool? availableForWork,
    String? search,
    String? location,
    String? sort,
  }) async {
    final params = <String, String>{
      if (skill != null && skill.trim().isNotEmpty) 'skill': skill.trim(),
      if (availableForWork != null)
        'availableForWork': availableForWork ? 'true' : 'false',
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (location != null && location.trim().isNotEmpty)
        'location': location.trim(),
      if (sort != null && sort.trim().isNotEmpty) 'sort': sort.trim(),
    };
    final q = params.entries
        .map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('&');
    final res =
        await _api.get('pro-networx/directory${q.isEmpty ? '' : '?$q'}');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => ProDirectoryItem.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => ProDirectoryItem.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
    }
    return const [];
  }

  Future<Map<String, dynamic>> getProfileByUserId(String userId) async {
    final res = await _api.get('pro-networx/profiles/$userId');
    if (res is Map<String, dynamic>) return res;
    throw Exception('Failed to load Pro profile');
  }

  // ---------------------------------------------------------------------------
  // Subscription / paywall access
  // ---------------------------------------------------------------------------
  /// Whether the current user has access to subscription-gated features
  /// (DMs, contact info reveal). Returns hasAccess=false plus the pricing
  /// payload when not subscribed.
  Future<ProNetworkAccess> getAccess() async {
    final res = await _api.get('pro-network-subscription/access');
    if (res is Map<String, dynamic>) return ProNetworkAccess.fromJson(res);
    return const ProNetworkAccess(
      hasAccess: false,
      status: null,
      currentPeriodEnd: null,
      regularCents: 999,
      introCents: 499,
    );
  }

  /// Creates a Stripe Checkout session URL on web. On mobile, prefer
  /// [createProNetworxPaymentSheet] for the native sheet experience.
  Future<Map<String, dynamic>> createProNetworxCheckoutSession({
    String? successUrl,
    String? cancelUrl,
  }) async {
    final res = await _api.post(
      'payments/create-pro-networx-checkout-session',
      {
        if (successUrl != null) 'successUrl': successUrl,
        if (cancelUrl != null) 'cancelUrl': cancelUrl,
      },
    );
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  /// Returns ephemeral key + setup intent + customer id for the Stripe
  /// PaymentSheet flow on mobile.
  Future<Map<String, dynamic>> createProNetworxPaymentSheet({
    String? customerEmail,
  }) async {
    final res = await _api.post(
      'payments/create-pro-networx-payment-sheet',
      {if (customerEmail != null) 'customerEmail': customerEmail},
    );
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  // ---------------------------------------------------------------------------
  // Feed: like / unlike / comments / search / explore
  // ---------------------------------------------------------------------------
  Future<({List<ProFeedPost> items, String? nextCursor})> listFeed({
    int limit = 20,
    String? cursor,
    String scope = 'all',
  }) async {
    final params = <String>[
      'limit=$limit',
      if (cursor != null && cursor.isNotEmpty) 'cursor=${Uri.encodeComponent(cursor)}',
      'scope=$scope',
    ].join('&');
    final res = await _api.get('discovery/feed?$params');
    return _parseFeedResponse(res);
  }

  Future<({List<ProFeedPost> items, String? nextCursor})> listUserPosts(
    String userId, {
    int limit = 24,
    String? cursor,
  }) async {
    final params = <String>[
      'limit=$limit',
      if (cursor != null && cursor.isNotEmpty)
        'cursor=${Uri.encodeComponent(cursor)}',
    ].join('&');
    final res = await _api.get('discovery/feed/users/$userId/posts?$params');
    return _parseFeedResponse(res);
  }

  Future<({List<ProFeedPost> items, String? nextCursor})> exploreStream({
    String? cursor,
    String? anchorPostId,
    int limit = 12,
  }) async {
    final parts = <String>['limit=$limit'];
    if (cursor != null && cursor.isNotEmpty) {
      parts.add('cursor=${Uri.encodeComponent(cursor)}');
    }
    if (anchorPostId != null && anchorPostId.isNotEmpty) {
      parts.add('anchorPostId=${Uri.encodeComponent(anchorPostId)}');
    }
    final res = await _api.get('discovery/feed/explore-stream?${parts.join('&')}');
    return _parseFeedResponse(res);
  }

  Future<List<ProFeedPost>> exploreTiles({int limit = 60, String? seed}) async {
    final parts = <String>['limit=$limit'];
    if (seed != null && seed.isNotEmpty) {
      parts.add('seed=${Uri.encodeComponent(seed)}');
    }
    final res = await _api.get('discovery/feed/explore?${parts.join('&')}');
    return _parseFeedResponse(res).items;
  }

  Future<ProSearchResult> searchFeed(String query) async {
    final res =
        await _api.get('discovery/feed/search?q=${Uri.encodeComponent(query)}');
    if (res is Map<String, dynamic>) return ProSearchResult.fromJson(res);
    return const ProSearchResult(people: [], posts: []);
  }

  Future<void> likePost(String postId) async {
    await _api.post('discovery/feed/posts/$postId/like', null);
  }

  Future<void> unlikePost(String postId) async {
    await _api.delete('discovery/feed/posts/$postId/like');
  }

  Future<List<ProFeedComment>> listComments(String postId,
      {int limit = 50, String? before}) async {
    final parts = <String>['limit=$limit'];
    if (before != null && before.isNotEmpty) {
      parts.add('before=${Uri.encodeComponent(before)}');
    }
    final res = await _api
        .get('discovery/feed/posts/$postId/comments?${parts.join('&')}');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => ProFeedComment.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }

  Future<ProFeedComment> createComment(String postId, String body) async {
    final res = await _api.post(
      'discovery/feed/posts/$postId/comments',
      {'body': body},
    );
    if (res is Map<String, dynamic>) return ProFeedComment.fromJson(res);
    throw Exception('Failed to create comment');
  }

  Future<void> deleteComment(String commentId) async {
    await _api.delete('discovery/feed/comments/$commentId');
  }

  /// Upload an image or short video as a feed post.
  Future<ProFeedPost> createFeedPost(File file, {String? caption}) async {
    final mime = _inferImageMime(file.path) ?? 'application/octet-stream';
    final res = await _api.postMultipart(
      'discovery/feed',
      {if (caption != null && caption.trim().isNotEmpty) 'caption': caption.trim()},
      [
        await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: MediaType.parse(mime),
        ),
      ],
    );
    if (res is Map<String, dynamic>) return ProFeedPost.fromJson(res);
    throw Exception('Failed to create post');
  }

  // ---------------------------------------------------------------------------
  // Services marketplace
  // ---------------------------------------------------------------------------
  Future<({List<ProServiceListing> items, int total})> listServices({
    String? serviceType,
    String? search,
    int? minPriceCents,
    int? maxPriceCents,
    int limit = 24,
    int offset = 0,
  }) async {
    final parts = <String>[
      'limit=$limit',
      'offset=$offset',
      if (serviceType != null && serviceType.isNotEmpty)
        'serviceType=${Uri.encodeComponent(serviceType)}',
      if (search != null && search.trim().isNotEmpty)
        'search=${Uri.encodeComponent(search.trim())}',
      if (minPriceCents != null) 'minPriceCents=$minPriceCents',
      if (maxPriceCents != null) 'maxPriceCents=$maxPriceCents',
    ];
    final res = await _api.get('pro-networx/services?${parts.join('&')}');
    if (res is Map<String, dynamic>) {
      final items = (res['items'] as List?)
              ?.whereType<Map>()
              .map((e) => ProServiceListing.fromJson(
                  e.map((k, v) => MapEntry(k.toString(), v))))
              .toList() ??
          <ProServiceListing>[];
      final total = (res['total'] is int)
          ? res['total'] as int
          : int.tryParse((res['total'] ?? '0').toString()) ?? items.length;
      return (items: items, total: total);
    }
    return (items: <ProServiceListing>[], total: 0);
  }

  Future<ProServiceListing> getService(String id) async {
    final res = await _api.get('pro-networx/services/$id');
    if (res is Map<String, dynamic>) return ProServiceListing.fromJson(res);
    throw Exception('Failed to load service');
  }

  Future<List<ProServiceListing>> listServicesForUser(String userId) async {
    final res = await _api.get('pro-networx/users/$userId/services');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => ProServiceListing.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }

  Future<List<ProServiceListing>> listMyServices() async {
    final res = await _api.get('pro-networx/me/services');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => ProServiceListing.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList();
      }
    }
    return const [];
  }

  Future<ProServiceListing> createService({
    required String serviceType,
    required String title,
    String? description,
    int? priceCents,
    String rateType = 'fixed',
    String currency = 'USD',
    String? contactEmail,
    String? contactPhone,
    String? contactLink,
    bool isPublished = true,
  }) async {
    final res = await _api.post('pro-networx/me/services', {
      'serviceType': serviceType,
      'title': title,
      if (description != null) 'description': description,
      if (priceCents != null) 'priceCents': priceCents,
      'rateType': rateType,
      'currency': currency,
      if (contactEmail != null) 'contactEmail': contactEmail,
      if (contactPhone != null) 'contactPhone': contactPhone,
      if (contactLink != null) 'contactLink': contactLink,
      'isPublished': isPublished,
    });
    if (res is Map<String, dynamic>) return ProServiceListing.fromJson(res);
    throw Exception('Failed to create service');
  }

  Future<ProServiceListing> updateService(
    String id, {
    String? serviceType,
    String? title,
    String? description,
    int? priceCents,
    String? rateType,
    String? currency,
    String? contactEmail,
    String? contactPhone,
    String? contactLink,
    bool? isPublished,
  }) async {
    final res = await _api.patch('pro-networx/me/services/$id', {
      if (serviceType != null) 'serviceType': serviceType,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (priceCents != null) 'priceCents': priceCents,
      if (rateType != null) 'rateType': rateType,
      if (currency != null) 'currency': currency,
      if (contactEmail != null) 'contactEmail': contactEmail,
      if (contactPhone != null) 'contactPhone': contactPhone,
      if (contactLink != null) 'contactLink': contactLink,
      if (isPublished != null) 'isPublished': isPublished,
    });
    if (res is Map<String, dynamic>) return ProServiceListing.fromJson(res);
    throw Exception('Failed to update service');
  }

  Future<void> deleteService(String id) async {
    await _api.delete('pro-networx/me/services/$id');
  }

  // ---------------------------------------------------------------------------
  // Resume PDF
  // ---------------------------------------------------------------------------
  Future<({String? url, String? filename})> getMyResume() async {
    final res = await _api.get('pro-networx/me/resume');
    if (res is Map<String, dynamic>) {
      return (
        url: (res['url'])?.toString(),
        filename: (res['filename'])?.toString(),
      );
    }
    return (url: null, filename: null);
  }

  Future<({String url, String filename})> uploadResume(File file) async {
    final res = await _api.postMultipart(
      'pro-networx/me/resume',
      {},
      [
        await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: MediaType('application', 'pdf'),
        ),
      ],
    );
    if (res is Map<String, dynamic>) {
      return (
        url: (res['url'] ?? '').toString(),
        filename: (res['filename'] ?? '').toString(),
      );
    }
    throw Exception('Failed to upload resume');
  }

  Future<void> deleteResume() async {
    await _api.delete('pro-networx/me/resume');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  ({List<ProFeedPost> items, String? nextCursor}) _parseFeedResponse(
      dynamic res) {
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      String? nextCursor;
      final raw = res['nextCursor'];
      if (raw is String && raw.isNotEmpty) nextCursor = raw;
      if (items is List) {
        return (
          items: items
              .whereType<Map>()
              .map((e) => ProFeedPost.fromJson(
                  e.map((k, v) => MapEntry(k.toString(), v))))
              .toList(),
          nextCursor: nextCursor,
        );
      }
    }
    if (res is List) {
      return (
        items: res
            .whereType<Map>()
            .map((e) => ProFeedPost.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v))))
            .toList(),
        nextCursor: null,
      );
    }
    return (items: <ProFeedPost>[], nextCursor: null);
  }

  String? _inferImageMime(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return null;
  }
}
