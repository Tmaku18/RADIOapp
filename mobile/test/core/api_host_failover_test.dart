import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/services/api_service.dart';

/// Host failover: a disabled-project 402 must try the next candidate, but a
/// 502 on a write must not, because Nest may already have applied it.
void main() {
  late ApiService api;
  HttpServer? first;
  HttpServer? second;

  setUp(() {
    api = ApiService();
    api.setAuthToken('test-token');
    api.resetResolvedBaseUrl();
  });

  tearDown(() async {
    api.debugBaseUrls = null;
    api.resetResolvedBaseUrl();
    await first?.close(force: true);
    await second?.close(force: true);
    first = null;
    second = null;
  });

  Future<HttpServer> serve({
    required int status,
    String body = '{"ok":true}',
    void Function()? onHit,
  }) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((request) async {
      onHit?.call();
      await request.drain<void>();
      request.response
        ..statusCode = status
        ..headers.contentType = ContentType.json
        ..write(body);
      await request.response.close();
    });
    return server;
  }

  test('GET falls through a 402 host to a healthy second host', () async {
    first = await serve(status: 402, body: 'Payment required\nDEPLOYMENT_DISABLED');
    second = await serve(status: 200, body: '{"title":"Gold Like Corral"}');
    api.debugBaseUrls = [
      'http://127.0.0.1:${first!.port}',
      'http://127.0.0.1:${second!.port}',
    ];

    final result = await api.get('radio/current');
    expect(result, isA<Map>());
    expect(result['title'], 'Gold Like Corral');
  });

  test('GET falls through a 502 host to a healthy second host', () async {
    first = await serve(status: 502, body: '{"message":"Bad Gateway"}');
    second = await serve(status: 200, body: '{"title":"Point to Prove"}');
    api.debugBaseUrls = [
      'http://127.0.0.1:${first!.port}',
      'http://127.0.0.1:${second!.port}',
    ];

    final result = await api.get('radio/current');
    expect(result['title'], 'Point to Prove');
  });

  test('POST does not fail over on 502', () async {
    var secondHits = 0;
    first = await serve(status: 502, body: '{"message":"Bad Gateway"}');
    second = await serve(
      status: 200,
      body: '{"ok":true}',
      onHit: () => secondHits += 1,
    );
    api.debugBaseUrls = [
      'http://127.0.0.1:${first!.port}',
      'http://127.0.0.1:${second!.port}',
    ];

    await expectLater(
      api.post('radio/heartbeat', {'ok': true}),
      throwsA(
        isA<ApiException>().having((e) => e.statusCode, 'statusCode', 502),
      ),
    );
    expect(secondHits, 0);
  });

  test('POST does fail over on 402', () async {
    first = await serve(status: 402, body: 'DEPLOYMENT_DISABLED');
    second = await serve(status: 200, body: '{"applied":true}');
    api.debugBaseUrls = [
      'http://127.0.0.1:${first!.port}',
      'http://127.0.0.1:${second!.port}',
    ];

    final result = await api.post('radio/heartbeat', {'ok': true});
    expect(result['applied'], true);
  });

  test('GET does not fail over on 404', () async {
    var secondHits = 0;
    first = await serve(status: 404, body: '{"message":"Cannot GET /api/missing"}');
    second = await serve(
      status: 200,
      body: '{"ok":true}',
      onHit: () => secondHits += 1,
    );
    api.debugBaseUrls = [
      'http://127.0.0.1:${first!.port}',
      'http://127.0.0.1:${second!.port}',
    ];

    await expectLater(
      api.get('missing'),
      throwsA(
        isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404),
      ),
    );
    expect(secondHits, 0);
  });
}
