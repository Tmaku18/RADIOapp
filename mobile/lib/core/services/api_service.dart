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

  Future<Map<String, dynamic>> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final body = response.body.trim();
      if (body.isEmpty) {
        return {};
      }
      final decoded = json.decode(body);
      if (decoded == null) {
        return {};
      }
      return decoded as Map<String, dynamic>;
    } else {
      throw Exception('Failed to load: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> post(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to post: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> put(
    String endpoint,
    Map<String, dynamic>? body,
  ) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
      body: body != null ? json.encode(body) : null,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to put: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/$endpoint'),
      headers: _headers,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to delete: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> postMultipart(
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
      final responseBody = response.body;
      if (responseBody.isEmpty) {
        return {};
      }
      return json.decode(responseBody) as Map<String, dynamic>;
    } else {
      throw Exception('Failed to upload: ${response.statusCode} - ${response.body}');
    }
  }
}
