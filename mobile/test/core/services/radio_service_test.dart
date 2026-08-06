import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/services/radio_service.dart';

void main() {
  group('RadioService.buildNextEndpoint', () {
    test('asks for the current queue position by default', () {
      expect(
        RadioService.buildNextEndpoint(radioId: 'us-rap'),
        'radio/next?radio=us-rap',
      );
    });

    test('names the finished song on a forced advance', () {
      expect(
        RadioService.buildNextEndpoint(
          radioId: 'us-rap',
          force: true,
          after: 'song-123',
        ),
        'radio/next?radio=us-rap&force=true&after=song-123',
      );
    });

    test('omits an empty after so the server falls back to its debounce', () {
      expect(
        RadioService.buildNextEndpoint(
          radioId: 'us-rap',
          force: true,
          after: '   ',
        ),
        'radio/next?radio=us-rap&force=true',
      );
    });

    test('encodes ids that need escaping', () {
      expect(
        RadioService.buildNextEndpoint(radioId: 'us rap', after: 'a&b'),
        'radio/next?radio=us+rap&after=a%26b',
      );
    });
  });
}
