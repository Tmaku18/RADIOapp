import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../env.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? responseBody;

  ApiException({
    required this.statusCode,
    required this.message,
    this.responseBody,
  });

  /// Prefer Nest/API body message when present (string or validation array).
  static String messageFromBody(String? body, {required String fallback}) {
    if (body == null || body.trim().isEmpty) return fallback;
    try {
      final decoded = json.decode(body);
      if (decoded is Map) {
        final msg = decoded['message'];
        if (msg is String && msg.trim().isNotEmpty) return msg.trim();
        if (msg is List && msg.isNotEmpty) {
          final parts = msg
              .map((e) => e?.toString().trim() ?? '')
              .where((e) => e.isNotEmpty)
              .toList();
          if (parts.isNotEmpty) return parts.join(' ');
        }
      }
    } catch (_) {}
    return fallback;
  }

  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();
  static const Duration _requestTimeout = Duration(seconds: 15);
  static const Duration _uploadTimeout = Duration(seconds: 120);
  /// Direct Nest/Railway host — Vercel (networxradio.com) rejects large
  /// multipart bodies with 413 before the Nest 75MB limit applies.
  static const String _directBackendFallback =
      'https://backend-production-17cc.up.railway.app';
  String? _resolvedBaseUrl;

  String get baseUrl => env('API_BASE_URL') ?? 'https://www.networxradio.com';
  String? _authToken;
  /// Prefer named `forceRefresh` so Firebase can mint a new JWT after 401s.
  Future<String?> Function({bool forceRefresh})? _tokenProvider;
  Future<void> Function()? _onUnauthorized;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  void setAuthTokenProvider(
    Future<String?> Function({bool forceRefresh})? provider,
  ) {
    _tokenProvider = provider;
  }

  void setUnauthorizedHandler(Future<void> Function()? handler) {
    _onUnauthorized = handler;
  }

  /// Always resolve via the provider when available (web parity). Firebase's
  /// [getIdToken] returns a cached JWT when still valid and refreshes when
  /// expired — so likes/votes keep working after long background sessions.
  Future<Map<String, String>> _headers({bool forceRefresh = false}) async {
    String? token = forceRefresh ? null : _authToken;
    if (_tokenProvider != null) {
      try {
        final fresh = await _tokenProvider!(forceRefresh: forceRefresh);
        if (fresh != null && fresh.isNotEmpty) {
          token = fresh;
          _authToken = fresh;
        }
      } catch (_) {
        // Keep any previously cached token if the provider briefly fails.
        token ??= _authToken;
      }
    }
    final platform = !kIsWeb && Platform.isIOS
        ? 'ios'
        : !kIsWeb && Platform.isAndroid
            ? 'android'
            : 'web';
    return {
      'Content-Type': 'application/json',
      'x-client-platform': platform,
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  Future<void> _handleUnauthorized() async {
    if (_onUnauthorized != null) {
      try {
        await _onUnauthorized!.call();
      } catch (_) {}
    }
  }

  List<String> _baseUrlCandidates({bool preferDirectBackend = false}) {
    final urls = <String>[];

    void add(String? raw) {
      if (raw == null) return;
      final trimmed = raw.trim().replaceAll(RegExp(r'/$'), '');
      if (trimmed.isEmpty) return;
      if (!urls.contains(trimmed)) {
        urls.add(trimmed);
      }
    }

    if (preferDirectBackend) {
      // Large uploads must hit Nest/Railway, not the Vercel web proxy.
      add(env('API_DIRECT_URL'));
      add(env('BACKEND_URL'));
      add(_directBackendFallback);
    }

    add(_resolvedBaseUrl);
    add(baseUrl);
    // Production fallbacks so mobile still works when local dev API is unavailable.
    add('https://www.networxradio.com');
    add('https://networxradio.com');
    if (!preferDirectBackend) {
      add(_directBackendFallback);
    }
    add('http://10.0.2.2:3000');
    add('http://10.0.2.2:3005');
    add('http://localhost:3000');
    add('http://localhost:3005');
    return urls;
  }

  bool _shouldTryNextBaseUrl(Object error) {
    if (error is TimeoutException) return true;
    if (error is http.ClientException) return true;
    // Vercel / edge proxies return 413 for large multipart bodies.
    if (error is ApiException && error.statusCode == 413) return true;
    return false;
  }

  Future<dynamic> _withFallback(
    Future<http.Response> Function(String base, Map<String, String> headers)
        request,
    String endpoint,
    String method, {
    bool preferDirectBackend = false,
    Duration? timeout,
  }) async {
    final candidates = _baseUrlCandidates(
      preferDirectBackend: preferDirectBackend,
    );
    Object? lastError;
    final effectiveTimeout = timeout ?? _requestTimeout;
    var authRetried = false;

    for (final base in candidates) {
      try {
        Future<http.Response> send({required bool forceRefresh}) async {
          final headers = await _headers(forceRefresh: forceRefresh);
          return request(base, headers).timeout(effectiveTimeout);
        }

        var response = await send(forceRefresh: false);

        // Stale Bearer after backgrounding: force-refresh once, then retry.
        if (response.statusCode == 401 && !authRetried) {
          authRetried = true;
          _authToken = null;
          await _handleUnauthorized();
          response = await send(forceRefresh: true);
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          _resolvedBaseUrl = base;
          final body = response.body.trim();
          if (body.isEmpty) {
            return null;
          }
          return json.decode(body);
        }
        final fallback = response.statusCode == 413
            ? '$method $endpoint failed: file too large for this host'
            : '$method $endpoint failed';
        throw ApiException(
          statusCode: response.statusCode,
          message: ApiException.messageFromBody(
            response.body,
            fallback: fallback,
          ),
          responseBody: response.body,
        );
      } catch (error) {
        if (!_shouldTryNextBaseUrl(error)) {
          rethrow;
        }
        lastError = error;
      }
    }

    if (lastError != null) {
      throw lastError;
    }
    throw ApiException(
      statusCode: 0,
      message: '$method $endpoint failed: no API base URL candidates',
    );
  }

  /// GET request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> get(String endpoint) async {
    return _withFallback(
      (base, headers) => http.get(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
      ),
      endpoint,
      'GET',
    );
  }

  /// POST request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> post(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    return _withFallback(
      (base, headers) => http.post(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
        body: body != null ? json.encode(body) : null,
      ),
      endpoint,
      'POST',
    );
  }

  /// PUT request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> put(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    return _withFallback(
      (base, headers) => http.put(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
        body: body != null ? json.encode(body) : null,
      ),
      endpoint,
      'PUT',
    );
  }

  /// PATCH request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> patch(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    return _withFallback(
      (base, headers) => http.patch(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
        body: body != null ? json.encode(body) : null,
      ),
      endpoint,
      'PATCH',
    );
  }

  /// DELETE request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> delete(String endpoint) async {
    return _withFallback(
      (base, headers) => http.delete(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
      ),
      endpoint,
      'DELETE',
    );
  }

  /// Multipart POST request for file uploads - returns dynamic.
  /// Prefers the direct Railway/Nest host so large videos are not rejected
  /// with HTTP 413 by the Vercel web proxy.
  Future<dynamic> postMultipart(
    String endpoint,
    Map<String, String> fields,
    List<http.MultipartFile> files,
  ) async {
    return _withFallback(
      (base, headers) async {
        final request = http.MultipartRequest(
          'POST',
          Uri.parse('$base/api/$endpoint'),
        );
        request.headers.addAll({
          if (headers['Authorization'] != null)
            'Authorization': headers['Authorization']!,
        });
        request.fields.addAll(fields);
        request.files.addAll(files);
        final streamedResponse = await request.send();
        return http.Response.fromStream(streamedResponse);
      },
      endpoint,
      'UPLOAD',
      preferDirectBackend: true,
      timeout: _uploadTimeout,
    );
  }
}
