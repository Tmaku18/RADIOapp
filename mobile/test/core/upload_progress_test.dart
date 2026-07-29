import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:radio_app/core/services/api_service.dart';

/// Guards the upload progress mechanism: `postMultipart` reports bytes as the
/// socket drains them, and a send that goes quiet fails fast instead of leaving
/// the user on an indeterminate spinner for the whole upload timeout.
void main() {
  late HttpServer server;
  late ApiService api;

  setUp(() {
    api = ApiService();
    api.setAuthToken('test-token');
    api.uploadWatchdogInterval = const Duration(milliseconds: 25);
  });

  tearDown(() async {
    api.debugBaseUrls = null;
    api.uploadStallTimeout = const Duration(seconds: 60);
    api.uploadProcessingTimeout = const Duration(minutes: 10);
    api.uploadWatchdogInterval = const Duration(seconds: 5);
    await server.close(force: true);
  });

  test('reports byte progress that ends at the full payload size', () async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) async {
      await request.drain<void>();
      request.response
        ..statusCode = 201
        ..headers.contentType = ContentType.json
        ..write('{"id":"post-1"}');
      await request.response.close();
    });
    api.debugBaseUrls = ['http://127.0.0.1:${server.port}'];

    final payload = List<int>.filled(3 * 1024 * 1024, 7);
    final samples = <int>[];
    var total = 0;

    final result = await api.postMultipart(
      'discovery/feed',
      {'caption': 'hello'},
      [http.MultipartFile.fromBytes('file', payload, filename: 'clip.mp4')],
      onProgress: (sent, size) {
        samples.add(sent);
        total = size;
      },
    );

    expect(result, isA<Map>());
    expect(total, greaterThan(payload.length));
    // A leading 0 lets the bar render before the first chunk drains.
    expect(samples.first, 0);
    expect(samples.last, total);
    expect(samples.length, greaterThan(2), reason: 'expected incremental ticks');
    for (var i = 1; i < samples.length; i++) {
      expect(samples[i], greaterThanOrEqualTo(samples[i - 1]));
    }
  });

  test('a server that never answers fails instead of hanging', () async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    // Take the whole body, then never respond. This is the case that used to
    // spin for 30 minutes with no feedback.
    server.listen((request) async => request.drain<void>());
    api.debugBaseUrls = ['http://127.0.0.1:${server.port}'];
    api.uploadStallTimeout = const Duration(milliseconds: 200);
    api.uploadProcessingTimeout = const Duration(milliseconds: 200);

    await expectLater(
      api.postMultipart(
        'discovery/feed',
        const {},
        [
          http.MultipartFile.fromBytes(
            'file',
            const [1, 2, 3],
            filename: 'a.mp4',
          ),
        ],
      ),
      throwsA(isA<TimeoutException>()),
    );
  });
}
