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

  String get baseUrl => env('API_BASE_URL') ?? 'http://localhost:3000';
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

  /// GET request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> get(String endpoint) async {
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = response.body.trim();
      if (body.isEmpty) {
        return null;
      }
      return json.decode(body);
    } else {
      if (response.statusCode == 401) {
        await _handleUnauthorized();
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'GET $endpoint failed',
        responseBody: response.body,
      );
    }
  }

  /// POST request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> post(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final headers = await _headers();
    final response = await http.post(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      if (response.statusCode == 401) {
        await _handleUnauthorized();
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'POST $endpoint failed',
        responseBody: response.body,
      );
    }
  }

  /// PUT request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> put(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final headers = await _headers();
    final response = await http.put(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      if (response.statusCode == 401) {
        await _handleUnauthorized();
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'PUT $endpoint failed',
        responseBody: response.body,
      );
    }
  }

  /// DELETE request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> delete(String endpoint) async {
    final headers = await _headers();
    final response = await http.delete(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      if (response.statusCode == 401) {
        await _handleUnauthorized();
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'DELETE $endpoint failed',
        responseBody: response.body,
      );
    }
  }

  /// Multipart POST request for file uploads - returns dynamic
  Future<dynamic> postMultipart(
    String endpoint,
    Map<String, String> fields,
    List<http.MultipartFile> files,
  ) async {
    final headers = await _headers();
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/$endpoint'),
    );

    request.headers.addAll({
      if (headers['Authorization'] != null)
        'Authorization': headers['Authorization']!,
    });

    request.fields.addAll(fields);
    request.files.addAll(files);

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      if (response.statusCode == 401) {
        await _handleUnauthorized();
      }
      throw ApiException(
        statusCode: response.statusCode,
        message: 'UPLOAD $endpoint failed',
        responseBody: response.body,
      );
    }
  }
}
