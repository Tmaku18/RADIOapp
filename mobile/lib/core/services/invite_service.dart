import 'dart:io';

import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../env.dart';

/// Builds and sends the "come try NETWORX Radio" invite a listener hands to a
/// friend.
///
/// Which link a friend needs depends on the platform they will install from.
/// Both links are overridable from `.env`.
class InviteService {
  InviteService._();

  /// Replace with the live App Store product URL via INVITE_URL_IOS after the
  /// listing is approved. Search is a safe public default until then.
  static const String _defaultAppStoreUrl =
      'https://apps.apple.com/us/search?term=Networx%20Radio';

  static const String _defaultPlayStoreUrl =
      'https://play.google.com/store/apps/details?id=com.tmaktechnologies.networxradio';

  /// Where a friend on this device's platform should go to install the app.
  static String get inviteLink {
    if (Platform.isIOS || Platform.isMacOS) {
      return _override('INVITE_URL_IOS') ?? _defaultAppStoreUrl;
    }
    return _override('INVITE_URL_ANDROID') ?? _defaultPlayStoreUrl;
  }

  /// Whether the invite sends friends through TestFlight, which needs a word of
  /// explanation most app links do not.
  static bool get isBetaInvite => inviteLink.contains('testflight.apple.com');

  static const String emailSubject = 'Come listen with me on NETWORX Radio';

  /// The message body, ready to drop into a text, an email, or the share sheet.
  static String get inviteMessage {
    final beta = isBetaInvite
        ? "\n\nIt's an Apple TestFlight beta, so install TestFlight first and "
              'the link will do the rest.'
        : '';
    return 'I\'ve been listening to NETWORX Radio — independent artists on '
        'live radio stations, and you can vote on what stays in rotation.\n\n'
        '$inviteLink$beta';
  }

  /// Opens the OS share sheet, which covers Messages, Mail, WhatsApp, AirDrop
  /// and anything else the friend actually uses.
  ///
  /// [origin] positions the iPad popover; without it, share sheets throw there.
  static Future<void> shareAnywhere({Rect? origin}) async {
    await SharePlus.instance.share(
      ShareParams(
        text: inviteMessage,
        subject: emailSubject,
        sharePositionOrigin: origin,
      ),
    );
  }

  /// The `sms:` URI for an invite with no recipient, so the composer opens on
  /// the contact picker.
  ///
  /// Built by hand rather than with [Uri.queryParameters], which encodes spaces
  /// as `+` — messaging apps show those literally instead of as spaces. iOS and
  /// Android also disagree on the separator when there is no phone number.
  static Uri buildSmsUri({required bool isIOS}) {
    final separator = isIOS ? '&' : '?';
    return Uri.parse('sms:${separator}body=${_encode(inviteMessage)}');
  }

  /// The `mailto:` URI for an invite with no recipient.
  static Uri buildEmailUri() {
    return Uri.parse(
      'mailto:?subject=${_encode(emailSubject)}&body=${_encode(inviteMessage)}',
    );
  }

  /// Opens the SMS composer prefilled with the invite.
  static Future<bool> shareViaText() =>
      _launch(buildSmsUri(isIOS: Platform.isIOS));

  /// Opens the mail composer prefilled with the invite.
  static Future<bool> shareViaEmail() => _launch(buildEmailUri());

  static Future<void> copyLink() {
    return Clipboard.setData(ClipboardData(text: inviteLink));
  }

  static Future<bool> _launch(Uri uri) async {
    try {
      return await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Simulators and devices with no SIM or mail account have no handler.
      return false;
    }
  }

  static String _encode(String value) => Uri.encodeComponent(value);

  static String? _override(String key) {
    final value = env(key)?.trim();
    return (value == null || value.isEmpty) ? null : value;
  }
}
