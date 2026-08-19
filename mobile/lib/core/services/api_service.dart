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

  /// User-facing text for any thrown API/network error.
  static String userMessage(Object error) {
    if (error is ApiException && error.message.trim().isNotEmpty) {
      return error.message;
    }
    if (isTlsError(error)) {
      return 'Couldn’t reach Networx securely. Check your connection and tap Refresh.';
    }
    return error.toString().replaceFirst('Exception: ', '');
  }
}

/// TLS failures from dart:io or package:http. The site proxy can fail
/// certificate checks on some networks while the Railway host still works.
bool isTlsError(Object error) {
  if (error is HandshakeException ||
      error is CertificateException ||
      error is TlsException) {
    return true;
  }
  final text = error.toString();
  return text.contains('CERTIFICATE_VERIFY_FAILED') ||
      text.contains('HandshakeException') ||
      text.contains('CERTIFICATE_VERIFY');
}

/// Multipart request that reports bytes as the socket consumes them, so uploads
/// can show real progress instead of an indeterminate spinner.
class _ProgressMultipartRequest extends http.MultipartRequest {
  _ProgressMultipartRequest(super.method, super.url, {this.onProgress});

  final void Function(int sent, int total)? onProgress;

  @override
  http.ByteStream finalize() {
    final body = super.finalize();
    final report = onProgress;
    if (report == null) return body;
    final total = contentLength;
    var sent = 0;
    return http.ByteStream(
      body.transform(
        StreamTransformer<List<int>, List<int>>.fromHandlers(
          handleData: (chunk, sink) {
            sent += chunk.length;
            report(sent, total);
            sink.add(chunk);
          },
        ),
      ),
    );
  }
}

/// Streams a file from disk as a raw request body, reporting bytes as the socket
/// consumes them. Keeps large uploads off the heap — the whole point of sending
/// video straight to storage rather than through the API.
class _FileStreamRequest extends http.BaseRequest {
  _FileStreamRequest(super.method, super.url, {required this.file, this.onProgress});

  final File file;
  final void Function(int sent, int total)? onProgress;

  @override
  http.ByteStream finalize() {
    super.finalize();
    final report = onProgress;
    final total = contentLength ?? 0;
    var sent = 0;
    final body = file.openRead();
    if (report == null) return http.ByteStream(body);
    return http.ByteStream(
      body.transform(
        StreamTransformer<List<int>, List<int>>.fromHandlers(
          handleData: (chunk, sink) {
            sent += chunk.length;
            report(sent, total);
            sink.add(chunk);
          },
        ),
      ),
    );
  }
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();
  static const Duration _requestTimeout = Duration(seconds: 15);
  /// Feed media can reach 1GB, which outlasts any short request timeout on a
  /// cellular connection. The stall watchdog below is what actually catches a
  /// dead upload — this is only a backstop.
  static const Duration _uploadTimeout = Duration(minutes: 45);

  /// Bytes stopped moving for this long mid-send: the connection is dead, so
  /// fail now instead of spinning until the overall timeout.
  static const Duration _uploadStallTimeout = Duration(seconds: 60);

  /// Once the last byte is sent the API still has to store the file, which
  /// reports no progress. Allow for that before calling it stalled.
  static const Duration _uploadProcessingTimeout = Duration(minutes: 10);
  /// Direct Nest/Railway host — Vercel (networxradio.com) rejects large
  /// multipart bodies with 413 before the Nest feed upload limit applies.
  static const String _directBackendFallback =
      'https://backend-production-17cc.up.railway.app';
  String? _resolvedBaseUrl;

  /// Test seams: pin the host and shorten the upload watchdog so upload tests
  /// run against a local server in milliseconds instead of the real backend.
  @visibleForTesting
  List<String>? debugBaseUrls;
  @visibleForTesting
  Duration uploadStallTimeout = _uploadStallTimeout;
  @visibleForTesting
  Duration uploadProcessingTimeout = _uploadProcessingTimeout;
  @visibleForTesting
  Duration uploadWatchdogInterval = const Duration(seconds: 5);

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
    final pinned = debugBaseUrls;
    if (pinned != null) return pinned;
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
    if (!kReleaseMode) {
      add('http://10.0.2.2:3000');
      add('http://10.0.2.2:3005');
      add('http://localhost:3000');
      add('http://localhost:3005');
    }
    return urls;
  }

  bool _shouldTryNextBaseUrl(Object error) {
    if (error is TimeoutException) return true;
    if (error is SocketException) return true;
    if (error is http.ClientException) return true;
    if (isTlsError(error)) return true;
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
    bool Function(Object error)? shouldFallback,
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
        if (!(shouldFallback ?? _shouldTryNextBaseUrl)(error)) {
          rethrow;
        }
        lastError = error;
      }
    }

    if (lastError != null) {
      if (isTlsError(lastError)) {
        throw ApiException(
          statusCode: 0,
          message: ApiException.userMessage(lastError),
        );
      }
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
    Map<String, dynamic>? body, {
    bool preferDirectBackend = false,
    Duration? timeout,
  }) async {
    return _withFallback(
      (base, headers) => http.post(
        Uri.parse('$base/api/$endpoint'),
        headers: headers,
        body: body != null ? json.encode(body) : null,
      ),
      endpoint,
      'POST',
      preferDirectBackend: preferDirectBackend,
      timeout: timeout,
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
  ///
  /// [onProgress] reports bytes sent / total so callers can show a real
  /// progress bar. A send that goes quiet for [_uploadStallTimeout] is failed
  /// immediately rather than left hanging until the overall timeout.
  Future<dynamic> postMultipart(
    String endpoint,
    Map<String, String> fields,
    List<http.MultipartFile> files, {
    void Function(int sent, int total)? onProgress,
  }) async {
    var bytesSent = 0;
    return _withFallback(
      (base, headers) async {
        bytesSent = 0;
        var lastProgressAt = DateTime.now();
        var total = 0;

        final request = _ProgressMultipartRequest(
          'POST',
          Uri.parse('$base/api/$endpoint'),
          onProgress: (sent, size) {
            bytesSent = sent;
            total = size;
            lastProgressAt = DateTime.now();
            onProgress?.call(sent, size);
          },
        );
        request.headers.addAll({
          if (headers['Authorization'] != null)
            'Authorization': headers['Authorization']!,
        });
        request.fields.addAll(fields);
        request.files.addAll(files);
        total = request.contentLength;
        onProgress?.call(0, total);

        return _sendWatched(
          request,
          sent: () => bytesSent,
          total: () => total,
          lastProgressAt: () => lastProgressAt,
        );
      },
      endpoint,
      'UPLOAD',
      preferDirectBackend: true,
      timeout: _uploadTimeout,
      shouldFallback: (error) {
        // 413 means this host will never accept the body, so the next one is
        // worth a try. Anything else once bytes were flowing would re-send the
        // whole file and most likely stall again — surface it instead.
        if (error is ApiException && error.statusCode == 413) return true;
        if (bytesSent > 0) return false;
        return _shouldTryNextBaseUrl(error);
      },
    );
  }

  /// Stream [file] straight to a storage signed URL, reporting progress.
  ///
  /// Deliberately bypasses [_withFallback]: the URL is absolute and already
  /// carries its own token, so our Bearer header must not be attached and there
  /// is no alternate host to fall back to. The body is streamed from disk so a
  /// 1GB clip never lands in the phone's memory.
  Future<void> putFileToSignedUrl(
    String signedUrl,
    File file, {
    required String contentType,
    void Function(int sent, int total)? onProgress,
  }) async {
    final length = await file.length();
    var bytesSent = 0;
    var lastProgressAt = DateTime.now();

    final request = _FileStreamRequest(
      'PUT',
      Uri.parse(signedUrl),
      file: file,
      onProgress: (sent, total) {
        bytesSent = sent;
        lastProgressAt = DateTime.now();
        onProgress?.call(sent, total);
      },
    );
    request.contentLength = length;
    request.headers['content-type'] = contentType;
    onProgress?.call(0, length);

    final response = await _sendWatched(
      request,
      sent: () => bytesSent,
      total: () => length,
      lastProgressAt: () => lastProgressAt,
    ).timeout(_uploadTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        message: ApiException.messageFromBody(
          response.body,
          fallback: response.statusCode == 413
              ? 'This file is over the storage upload limit.'
              : 'Upload to storage failed',
        ),
        responseBody: response.body,
      );
    }
  }

  /// Send [request] while watching for a stalled body, so a dead connection
  /// fails in seconds instead of hanging until the overall upload timeout.
  Future<http.Response> _sendWatched(
    http.BaseRequest request, {
    required int Function() sent,
    required int Function() total,
    required DateTime Function() lastProgressAt,
  }) async {
    // Own the client so a stalled upload can be torn down instead of holding
    // the socket open behind an abandoned future.
    final client = http.Client();
    final stalled = Completer<http.Response>();
    final watchdog = Timer.periodic(uploadWatchdogInterval, (timer) {
      if (stalled.isCompleted) {
        timer.cancel();
        return;
      }
      // No progress is expected after the last byte, while the server stores
      // the file, so allow a longer quiet period once sending is done.
      final bytes = sent();
      final size = total();
      final sending = size <= 0 || bytes < size;
      final limit = sending ? uploadStallTimeout : uploadProcessingTimeout;
      if (DateTime.now().difference(lastProgressAt()) <= limit) return;
      timer.cancel();
      stalled.completeError(
        TimeoutException(
          bytes == 0
              ? 'Upload could not start. Check your connection and try again.'
              : sending
                  ? 'Upload stalled. Check your connection and try again.'
                  : 'The server took too long to finish saving your upload.',
        ),
      );
    });

    try {
      final send = client
          .send(request)
          .then((streamed) => http.Response.fromStream(streamed));
      return await Future.any([send, stalled.future]);
    } finally {
      watchdog.cancel();
      client.close();
    }
  }
}
