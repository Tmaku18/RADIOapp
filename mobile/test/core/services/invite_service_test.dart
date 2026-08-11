import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/services/invite_service.dart';

void main() {
  group('InviteService', () {
    test('invite link points somewhere a friend can actually install from', () {
      final link = InviteService.inviteLink;
      expect(
        link,
        anyOf(
          contains('testflight.apple.com'),
          contains('play.google.com'),
          contains('apps.apple.com'),
        ),
      );
    });

    test('message carries the link so a bare paste still works', () {
      expect(InviteService.inviteMessage, contains(InviteService.inviteLink));
    });

    test('beta invites explain that TestFlight is needed first', () {
      // A raw TestFlight link is a dead end for anyone without the app
      // installed, so the invite has to say so.
      if (InviteService.isBetaInvite) {
        expect(InviteService.inviteMessage, contains('TestFlight'));
      }
    });

    test('sms body is percent-encoded, never plus-encoded', () {
      final uri = InviteService.buildSmsUri(isIOS: false);
      // Uri.queryParameters would encode spaces as '+', which messaging apps
      // render literally.
      expect(uri.toString(), isNot(contains('+')));
      expect(uri.toString(), startsWith('sms:?body='));
      expect(uri.scheme, 'sms');
    });

    test('ios sms uri uses the separator ios accepts without a recipient', () {
      expect(
        InviteService.buildSmsUri(isIOS: true).toString(),
        startsWith('sms:&body='),
      );
    });

    test('sms body decodes back to the invite message', () {
      final uri = InviteService.buildSmsUri(isIOS: false);
      final encoded = uri.toString().replaceFirst('sms:?body=', '');
      expect(Uri.decodeComponent(encoded), InviteService.inviteMessage);
    });

    test('email uri carries both a subject and the message', () {
      final uri = InviteService.buildEmailUri();
      expect(uri.scheme, 'mailto');
      final query = uri.toString().replaceFirst('mailto:?', '');
      expect(query, contains('subject='));
      expect(query, contains('body='));

      final subject = RegExp(r'subject=([^&]*)').firstMatch(query)!.group(1)!;
      expect(Uri.decodeComponent(subject), InviteService.emailSubject);
    });
  });
}
