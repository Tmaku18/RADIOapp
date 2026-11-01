/// A link shared from the app, or opened from the home-screen widget.
class ParsedAppLink {
  const ParsedAppLink({
    required this.kind,
    this.id,
    this.referralCode,
  });

  final AppLinkKind kind;
  final String? id;
  final String? referralCode;

  static final _referral = RegExp(r'^[A-Z0-9]{6,12}$');

  static ParsedAppLink? tryParse(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    final host = uri.host.toLowerCase();
    final allowedHost = host == 'networxradio.com' ||
        host == 'www.networxradio.com' ||
        host.isEmpty;
    if (scheme == 'https' || scheme == 'http') {
      if (!allowedHost || host.isEmpty) return null;
    } else if (scheme != 'networxradio') {
      return null;
    }

    final referral = _referralCode(uri);
    final parts = uri.pathSegments.where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty) {
      if (referral == null) return null;
      return ParsedAppLink(kind: AppLinkKind.referral, referralCode: referral);
    }

    final head = parts.first.toLowerCase();
    final id = parts.length > 1 ? parts[1].trim() : '';
    if (head == 'song' || head == 'songs') {
      if (id.isEmpty) return null;
      return ParsedAppLink(
        kind: AppLinkKind.song,
        id: id,
        referralCode: referral,
      );
    }
    if (head == 'artist' || head == 'artists' || head == 'u') {
      if (id.isEmpty) return null;
      return ParsedAppLink(
        kind: AppLinkKind.artist,
        id: id,
        referralCode: referral,
      );
    }
    if (head == 'radio') {
      return ParsedAppLink(
        kind: AppLinkKind.radio,
        id: id.isEmpty ? null : id,
        referralCode: referral,
      );
    }
    if (referral != null) {
      return ParsedAppLink(kind: AppLinkKind.referral, referralCode: referral);
    }
    return null;
  }

  static String? _referralCode(Uri uri) {
    final raw = uri.queryParameters['ref']?.trim().toUpperCase();
    if (raw == null || !_referral.hasMatch(raw)) return null;
    return raw;
  }
}

enum AppLinkKind { song, artist, radio, referral }

const String pendingReferralCodeKey = 'pending_referral_code';
