import '../env.dart';

/// Official NETWORX branding assets for in-app UI and lock-screen artwork.
class BrandAssets {
  BrandAssets._();

  static const String logoCyanAsset =
      'assets/images/branding/networx-logo-cyan.png';
  static const String logoCyanLightAsset =
      'assets/images/branding/networx-logo-cyan-light.png';

  static const String _logoCyanWebPath = '/images/networx-logo-cyan.png';

  /// Public URL for the full cyan wordmark (lock screen / media notifications).
  static String logoCyanUrl({String? webOrigin}) {
    final origin =
        webOrigin ?? env('API_BASE_URL') ?? 'https://www.networxradio.com';
    return '$origin$_logoCyanWebPath';
  }

  /// Legacy compact mark and removed local assets — not the full wordmark.
  static bool isDeprecatedArtwork(String? url) {
    if (url == null || url.trim().isEmpty) return true;
    final lower = url.toLowerCase();
    return lower.contains('logo-icon') ||
        lower.contains('logo_icon') ||
        lower.contains('logo_0') ||
        lower.contains('logo_1') ||
        lower.contains('/nx_0') ||
        lower.contains('og-flyer');
  }

  /// Song artwork when present; otherwise the hosted full cyan logo for Now Playing.
  static Uri mediaArtUri(String? artworkUrl, {String? webOrigin}) {
    if (artworkUrl != null &&
        artworkUrl.trim().isNotEmpty &&
        !isDeprecatedArtwork(artworkUrl)) {
      final parsed = Uri.tryParse(artworkUrl.trim());
      if (parsed != null) return parsed;
    }
    return Uri.parse(logoCyanUrl(webOrigin: webOrigin));
  }

  /// In-app display URL, or null to use [logoCyanAsset] locally.
  static String? displayArtworkUrl(String? artworkUrl) {
    if (artworkUrl != null &&
        artworkUrl.trim().isNotEmpty &&
        !isDeprecatedArtwork(artworkUrl)) {
      return artworkUrl.trim();
    }
    return null;
  }
}
