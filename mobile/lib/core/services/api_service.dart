import 'dart:async';
import 'dart:convert';
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

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();
  static const Duration _requestTimeout = Duration(seconds: 15);
  String? _resolvedBaseUrl;

  String get baseUrl => env('API_BASE_URL') ?? 'https://www.networxradio.com';
  String? _authToken;
  Future<String?> Function()? _tokenProvider;
  Future<void> Function()? _onUnauthorized;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  void setAuthTokenProvider(Future<String?> Function()? provider) {
    _tokenProvider = provider;
  }

  void setUnauthorizedHandler(Future<void> Function()? handler) {
    _onUnauthorized = handler;
  }

  Future<Map<String, String>> _headers() async {
    String? token = _authToken;
    if ((token == null || token.isEmpty) && _tokenProvider != null) {
      try {
        token = await _tokenProvider!.call();
        _authToken = token;
      } catch (_) {}
    }
    return {
      'Content-Type': 'application/json',
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

  List<String> _baseUrlCandidates() {
    final urls = <String>[];

    void add(String? raw) {
      if (raw == null) return;
      final trimmed = raw.trim();
      if (trimmed.isEmpty) return;
      if (!urls.contains(trimmed)) {
        urls.add(trimmed);
      }
    }

    add(_resolvedBaseUrl);
    add(baseUrl);
    // Production fallbacks so mobile still works when local dev API is unavailable.
    add('https://www.networxradio.com');
    add('https://networxradio.com');
    add('http://10.0.2.2:3000');
    add('http://10.0.2.2:3005');
    add('http://localhost:3000');
    add('http://localhost:3005');
    return urls;
  }

  bool _shouldTryNextBaseUrl(Object error) {
    if (error is TimeoutException) return true;
    if (error is http.ClientException) return true;
    return false;
  }

  Future<dynamic> _withFallback(
    Future<http.Response> Function(String base, Map<String, String> headers)
        request,
    String endpoint,
    String method,
  ) async {
    final headers = await _headers();
    final candidates = _baseUrlCandidates();
    Object? lastError;

    for (final base in candidates) {
      try {
        final response =
            await request(base, headers).timeout(_requestTimeout);
        if (response.statusCode >= 200 && response.statusCode < 300) {
          _resolvedBaseUrl = base;
          final body = response.body.trim();
          if (body.isEmpty) {
            return null;
          }
          return json.decode(body);
        }
        if (response.statusCode == 401) {
          await _handleUnauthorized();
        }
        throw ApiException(
          statusCode: response.statusCode,
          message: '$method $endpoint failed',
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

  /// Multipart POST request for file uploads - returns dynamic
  Future<dynamic> postMultipart(
    String endpoint,
    Map<String, String> fields,
    List<http.MultipartFile> files,
  ) async {
    return _withFallback((base, headers) async {
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
    }, endpoint, 'UPLOAD');
  }
}
