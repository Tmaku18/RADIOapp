import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:radio_app/core/services/api_service.dart';

void main() {
  test('isTlsError matches dart:io handshake failures', () {
    final error = HandshakeException(
      'Handshake error in client (OS Error: CERTIFICATE_VERIFY_FAILED: '
      'application verification failure(handshake.cc:298))',
    );
    expect(isTlsError(error), isTrue);
    expect(
      ApiException.userMessage(error),
      contains('Couldn’t reach Networx securely'),
    );
  });

  test('isTlsError matches ClientException wrappers', () {
    final error = http.ClientException(
      'HandshakeException: Handshake error in client '
      '(OS Error: CERTIFICATE_VERIFY_FAILED)',
    );
    expect(isTlsError(error), isTrue);
  });

  test('plain API messages stay as-is', () {
    expect(
      ApiException.userMessage(
        ApiException(statusCode: 500, message: 'Directory failed'),
      ),
      'Directory failed',
    );
  });
}
