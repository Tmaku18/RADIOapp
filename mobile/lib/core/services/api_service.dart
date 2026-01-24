import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl => dotenv.env['API_BASE_URL'] ?? 'http://localhost:3000';
  String? _authToken;

  void setAuthToken(String? token) {
    _authToken = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_authToken != null) 'Authorization': 'Bearer $_authToken',
      };

  /// GET request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = response.body.trim();
      if (body.isEmpty) {
        return null;
      }
      return json.decode(body);
    } else {
      throw Exception('Failed to load: ${response.statusCode}');
    }
  }

  /// POST request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> post(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      throw Exception('Failed to post: ${response.statusCode}');
    }
  }

  /// PUT request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> put(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      throw Exception('Failed to put: ${response.statusCode}');
    }
  }

  /// DELETE request - returns dynamic (can be Map or List depending on endpoint)
  Future<dynamic> delete(String endpoint) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final responseBody = response.body.trim();
      if (responseBody.isEmpty) {
        return null;
      }
      return json.decode(responseBody);
    } else {
      throw Exception('Failed to delete: ${response.statusCode}');
    }
  }

  /// Multipart POST request for file uploads - returns dynamic
  Future<dynamic> postMultipart(
    String endpoint,
    Map<String, String> fields,
    List<http.MultipartFile> files,
  ) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/api/$endpoint'),
    );

    request.headers.addAll({
      if (_authToken != null) 'Authorization': 'Bearer $_authToken',
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
      throw Exception('Failed to upload: ${response.statusCode} - ${response.body}');
    }
  }
}
