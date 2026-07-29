import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../models/pro_networx_models.dart';
import 'api_service.dart';

/// What the user attached to a feed post, so uploads can label ambiguous
/// container formats (an `.mp4` may be audio-only) with the right MIME type.
enum FeedMediaKind {
  image,
  video,
  audio;

  String get defaultMime => switch (this) {
        FeedMediaKind.image => 'image/jpeg',
        FeedMediaKind.video => 'video/quicktime',
        FeedMediaKind.audio => 'audio/mpeg',
      };
}

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

  Future<({List<ProDirectoryItem> items, int total})> listDirectory({
    String? skill,
    bool? availableForWork,
    String? search,
    String? location,
    String? sort,
    String mode = 'default',
    String? seed,
  }) async {
    final params = <String, String>{
      if (skill != null && skill.trim().isNotEmpty) 'skill': skill.trim(),
      if (availableForWork != null)
        'availableForWork': availableForWork ? 'true' : 'false',
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (location != null && location.trim().isNotEmpty)
        'location': location.trim(),
      if (sort != null && sort.trim().isNotEmpty) 'sort': sort.trim(),
      if (mode.trim().isNotEmpty) 'mode': mode.trim(),
      if (seed != null && seed.trim().isNotEmpty) 'seed': seed.trim(),
    };
    final q = params.entries
        .map((e) => '${Uri.encodeComponent(e.key)}=${Uri.encodeComponent(e.value)}')
        .join('&');
    final res =
        await _api.get('pro-networx/directory${q.isEmpty ? '' : '?$q'}');
    if (res is Map<String, dynamic>) {
      final items = res['items'];
      final totalRaw = res['total'];
      final total = totalRaw is int
          ? totalRaw
          : int.tryParse(totalRaw?.toString() ?? '') ??
              (items is List ? items.length : 0);
      if (items is List) {
        return (
          items: items
              .whereType<Map>()
              .map((e) => ProDirectoryItem.fromJson(
                  e.map((k, v) => MapEntry(k.toString(), v))))
              .toList(),
          total: total,
        );
      }
    }
    if (res is List) {
      final items = res
          .whereType<Map>()
          .map((e) => ProDirectoryItem.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList();
      return (items: items, total: items.length);
    }
    return (items: const <ProDirectoryItem>[], total: 0);
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

  /// Creates a Stripe Checkout session URL on web.
  /// On iOS/Android, Pro-Networx uses store IAP (see ProNetworkPaywallSheet).
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

  Future<void> deleteFeedPost(String postId) async {
    await _api.delete('discovery/feed/posts/$postId');
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

  Future<void> bookmarkPost(String postId) async {
    await _api.post('discovery/feed/posts/$postId/bookmark', null);
  }

  Future<void> unbookmarkPost(String postId) async {
    await _api.delete('discovery/feed/posts/$postId/bookmark');
  }

  Future<({List<ProFeedPost> items, String? nextCursor})> listBookmarks({
    int limit = 24,
    String? cursor,
  }) async {
    final parts = <String>['limit=$limit'];
    if (cursor != null && cursor.isNotEmpty) {
      parts.add('cursor=${Uri.encodeComponent(cursor)}');
    }
    final res = await _api.get('discovery/feed/bookmarks?${parts.join('&')}');
    return _parseFeedResponse(res);
  }

  Future<({List<ProFeedPost> items, String? nextCursor})> listLiked({
    int limit = 24,
    String? cursor,
  }) async {
    final parts = <String>['limit=$limit'];
    if (cursor != null && cursor.isNotEmpty) {
      parts.add('cursor=${Uri.encodeComponent(cursor)}');
    }
    final res = await _api.get('discovery/feed/liked?${parts.join('&')}');
    return _parseFeedResponse(res);
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

  /// Upload an image, short video, or audio track as a feed post.
  ///
  /// [kind] helps when iOS `image_picker` temp paths lack an extension —
  /// without it we'd send `application/octet-stream` and the API rejects.
  /// [cover] is the optional picture shown behind an audio post; audio posts
  /// without one fall back to the Networx Radio logo server-side.
  /// [onProgress] reports bytes sent / total for an upload progress bar.
  Future<ProFeedPost> createFeedPost(
    File file, {
    String? caption,
    FeedMediaKind kind = FeedMediaKind.image,
    File? cover,
    void Function(int sent, int total)? onProgress,
  }) async {
    final mime = _inferMediaMime(file.path, kind: kind) ?? kind.defaultMime;
    final res = await _api.postMultipart(
      'discovery/feed',
      {if (caption != null && caption.trim().isNotEmpty) 'caption': caption.trim()},
      [
        await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: MediaType.parse(mime),
          filename: _multipartFilename(file.path, mime),
        ),
        if (cover != null)
          await http.MultipartFile.fromPath(
            'cover',
            cover.path,
            contentType: MediaType.parse(
              _inferMediaMime(cover.path, kind: FeedMediaKind.image) ??
                  'image/jpeg',
            ),
            filename: _multipartFilename(
              cover.path,
              _inferMediaMime(cover.path, kind: FeedMediaKind.image) ??
                  'image/jpeg',
            ),
          ),
      ],
      onProgress: onProgress,
    );
    if (res is Map<String, dynamic>) return ProFeedPost.fromJson(res);
    throw Exception('Failed to create post');
  }

  /// Publish a video or audio post by streaming the media straight to storage,
  /// then telling the API where it landed.
  ///
  /// The API used to buffer the whole clip in memory and re-upload it, paying
  /// for the transfer twice. Images keep using [createFeedPost] so their bytes
  /// still pass through server-side moderation.
  Future<ProFeedPost> createFeedPostViaStorage(
    File file, {
    String? caption,
    FeedMediaKind kind = FeedMediaKind.video,
    File? cover,
    void Function(int sent, int total)? onProgress,
  }) async {
    if (kind == FeedMediaKind.image) {
      throw ArgumentError('Images must use createFeedPost for moderation.');
    }
    final mime = _inferMediaMime(file.path, kind: kind) ?? kind.defaultMime;

    final ticket = await _api.post('discovery/feed/upload-url', {
      'contentType': mime,
      'filename': _multipartFilename(file.path, mime),
    });
    final signedUrl = ticket is Map ? '${ticket['signedUrl'] ?? ''}' : '';
    final storagePath = ticket is Map ? '${ticket['path'] ?? ''}' : '';
    if (signedUrl.isEmpty || storagePath.isEmpty) {
      throw Exception('Failed to start upload');
    }

    await _api.putFileToSignedUrl(
      signedUrl,
      file,
      contentType: mime,
      onProgress: onProgress,
    );

    // Cover art still travels as multipart so it keeps its moderation pass.
    final coverMime = cover == null
        ? null
        : _inferMediaMime(cover.path, kind: FeedMediaKind.image) ??
            'image/jpeg';
    final res = await _api.postMultipart(
      'discovery/feed/from-upload',
      {
        'path': storagePath,
        'mediaType': kind == FeedMediaKind.audio ? 'audio' : 'video',
        // Lets the API pick the right parser when it re-checks length.
        'contentType': mime,
        if (caption != null && caption.trim().isNotEmpty)
          'caption': caption.trim(),
      },
      [
        if (cover != null && coverMime != null)
          await http.MultipartFile.fromPath(
            'cover',
            cover.path,
            contentType: MediaType.parse(coverMime),
            filename: _multipartFilename(cover.path, coverMime),
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

  Future<String?> uploadCover(File file) async {
    final mime = _inferImageMime(file.path) ?? 'image/jpeg';
    final res = await _api.postMultipart(
      'service-providers/me/cover',
      {},
      [
        await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: MediaType.parse(mime),
        ),
      ],
    );
    if (res is Map<String, dynamic>) {
      return (res['heroImageUrl'] ?? res['hero_image_url'])?.toString();
    }
    throw Exception('Failed to upload cover image');
  }

  // ---------------------------------------------------------------------------
  // Service-provider portfolio (Featured work: image / audio / video)
  // ---------------------------------------------------------------------------
  /// The current user's provider portfolio items (audio/image/video samples).
  /// Returns each item as { id, type, fileUrl, title, description, sortOrder }.
  Future<List<Map<String, dynamic>>> getMyPortfolio() async {
    final res = await _api.get('service-providers/me/profile');
    if (res is Map<String, dynamic>) {
      final items = res['portfolio'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
            .toList();
      }
    }
    return const [];
  }

  /// Uploads a portfolio file to the `portfolio` bucket via a signed URL and
  /// returns the public URL to attach to a portfolio item.
  Future<String> uploadPortfolioFile(File file, String contentType) async {
    final filename = file.path.split('/').last;
    final res = await _api.post('service-providers/portfolio/upload-url', {
      'filename': filename,
      'contentType': contentType,
    });
    if (res is! Map<String, dynamic>) {
      throw Exception('Failed to get portfolio upload URL');
    }
    final signedUrl = (res['signedUrl'] ?? res['signed_url'] ?? '').toString();
    final publicUrl = (res['publicUrl'] ?? res['public_url'] ?? '').toString();
    if (signedUrl.isEmpty || publicUrl.isEmpty) {
      throw Exception('Upload URL response missing fields');
    }
    final bytes = await file.readAsBytes();
    final put = await http.put(
      Uri.parse(signedUrl),
      headers: {'Content-Type': contentType},
      body: bytes,
    );
    if (put.statusCode < 200 || put.statusCode >= 300) {
      throw Exception('Upload failed (${put.statusCode})');
    }
    return publicUrl;
  }

  Future<void> addPortfolioItem({
    required String type,
    required String fileUrl,
    String? title,
    String? description,
  }) async {
    await _api.post('service-providers/me/portfolio', {
      'type': type,
      'fileUrl': fileUrl,
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
      'sortOrder': 0,
    });
  }

  Future<void> deletePortfolioItem(String id) async {
    await _api.delete('service-providers/me/portfolio/$id');
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

  String? _inferImageMime(String path) =>
      _inferMediaMime(path, kind: FeedMediaKind.image);

  String? _inferMediaMime(String path, {required FeedMediaKind kind}) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) {
      // .mp4 is ambiguous: audio-only exports share the container.
      return kind == FeedMediaKind.audio ? 'audio/mp4' : 'video/mp4';
    }
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mov') || lower.endsWith('.qt')) {
      return 'video/quicktime';
    }
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.m4a')) return 'audio/mp4';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.aac')) return 'audio/aac';
    if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
    if (lower.endsWith('.flac')) return 'audio/flac';
    return null;
  }

  /// Ensure multipart has a usable filename + extension (Nest/multer + storage).
  String _multipartFilename(String path, String mime) {
    final base = path.split(Platform.pathSeparator).last;
    final hasExt = base.contains('.') && !base.endsWith('.');
    if (hasExt) return base;
    final ext = switch (mime) {
      'image/jpeg' => 'jpg',
      'image/png' => 'png',
      'image/webp' => 'webp',
      'video/mp4' => 'mp4',
      'video/webm' => 'webm',
      'video/quicktime' => 'mov',
      'audio/mpeg' => 'mp3',
      'audio/mp4' => 'm4a',
      'audio/wav' || 'audio/x-wav' => 'wav',
      'audio/aac' => 'aac',
      'audio/ogg' => 'ogg',
      'audio/flac' => 'flac',
      _ => 'bin',
    };
    return '$base.$ext';
  }
}
