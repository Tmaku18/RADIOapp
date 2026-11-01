import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/navigation/app_link.dart';

void main() {
  test('parses a shared song link', () {
    final link = ParsedAppLink.tryParse(
      Uri.parse('https://www.networxradio.com/song/abc'),
    );
    expect(link?.kind, AppLinkKind.song);
    expect(link?.id, 'abc');
  });

  test('parses an artist link and a referral code', () {
    final link = ParsedAppLink.tryParse(
      Uri.parse('https://networxradio.com/artists/user-1?ref=ABCD2345'),
    );
    expect(link?.kind, AppLinkKind.artist);
    expect(link?.id, 'user-1');
    expect(link?.referralCode, 'ABCD2345');
  });

  test('parses a station from the custom scheme', () {
    final link = ParsedAppLink.tryParse(
      Uri.parse('networxradio://radio/us-rap'),
    );
    expect(link?.kind, AppLinkKind.radio);
    expect(link?.id, 'us-rap');
  });

  test('ignores another website', () {
    expect(
      ParsedAppLink.tryParse(Uri.parse('https://example.com/song/abc')),
      isNull,
    );
  });
}
