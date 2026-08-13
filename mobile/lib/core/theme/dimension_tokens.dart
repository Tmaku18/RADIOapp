import 'package:flutter/material.dart';

/// NETWORX visual tokens — a restrained, music-first system: near-black (or
/// pure white) surfaces, the electric cyan brand accent used sparingly, and
/// depth from elevation rather than glow.
///
/// Some token *names* predate this palette. Read them by role, not by the
/// colour in the name:
///   * [neonCyan] / [neonPink] / [pink400] — the single brand accent
///   * [neonYellow] — reserved for warning + "needs attention" states
///
/// Call [bindBrightness] from the app [MaterialApp.builder] so static getters
/// track ThemeMode without threading [BuildContext] through every call site.
class DimensionTokens {
  DimensionTokens._();

  static Brightness _brightness = Brightness.dark;

  /// Keep chrome in sync with Material brightness.
  static void bindBrightness(Brightness brightness) {
    _brightness = brightness;
  }

  /// Call at the start of [State.build] / [StatelessWidget.build] for any
  /// widget that paints with [DimensionTokens] static colors.
  ///
  /// Registers a [Theme] dependency so light/dark switches rebuild immediately
  /// (static getters alone do not listen to [ThemeMode] changes).
  static Brightness watch(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    bindBrightness(brightness);
    return brightness;
  }

  static bool get isDark => _brightness == Brightness.dark;

  // —— Dark: true black base so artwork is the brightest thing on screen ——
  static const Color _bgBaseDark = Color(0xFF000000);
  static const Color _bgSurfaceDark = Color(0xFF1C1C1E);
  static const Color _bgElevatedDark = Color(0xFF2C2C2E);
  static const Color _accentDark = Color(0xFF00F0FF);
  static const Color _accentPressedDark = Color(0xFF67E8F9);
  static const Color _warningDark = Color(0xFFFFD60A);
  static const Color _textPrimaryDark = Color(0xFFFFFFFF);
  static const Color _textSecondaryDark = Color(0xFF9E9EA7);
  static const Color _textMutedDark = Color(0xFF6C6C72);

  // —— Light: paper white with grouped-list grey ——
  static const Color _bgBaseLight = Color(0xFFFFFFFF);
  static const Color _bgSurfaceLight = Color(0xFFF2F2F7);
  static const Color _bgElevatedLight = Color(0xFFFFFFFF);
  static const Color _accentLight = Color(0xFF0E7490);
  static const Color _accentPressedLight = Color(0xFF0E9AA7);
  static const Color _warningLight = Color(0xFFB25000);
  static const Color _textPrimaryLight = Color(0xFF000000);
  static const Color _textSecondaryLight = Color(0xFF6B6B70);
  static const Color _textMutedLight = Color(0xFF8A8A8E);

  static Color get bgBase => isDark ? _bgBaseDark : _bgBaseLight;
  static Color get bgSurface => isDark ? _bgSurfaceDark : _bgSurfaceLight;

  /// One step above [bgSurface] — sheets, raised rows, pressed states.
  static Color get bgElevated => isDark ? _bgElevatedDark : _bgElevatedLight;

  /// The brand accent. Named `neonCyan` for historical reasons.
  static Color get neonCyan => isDark ? _accentDark : _accentLight;
  static Color get neonPink => isDark ? _accentDark : _accentLight;
  static Color get pink400 => isDark ? _accentDark : _accentLight;
  static Color get cyan300 =>
      isDark ? _accentPressedDark : _accentPressedLight;

  /// Warning / attention only (offline, reconnecting, expiring).
  static Color get neonYellow => isDark ? _warningDark : _warningLight;

  static Color get textPrimary =>
      isDark ? _textPrimaryDark : _textPrimaryLight;
  static Color get textSecondary =>
      isDark ? _textSecondaryDark : _textSecondaryLight;
  static Color get textMuted => isDark ? _textMutedDark : _textMutedLight;

  /// Fade color used by the ambient backdrop wash.
  static Color get backdropFade => isDark ? Colors.black : _bgBaseLight;

  /// Hairline separator — the only border most surfaces get.
  static Color get glassBorder => isDark
      ? Colors.white.withValues(alpha: 0.09)
      : Colors.black.withValues(alpha: 0.08);

  static Color get glassBorderStrong => isDark
      ? Colors.white.withValues(alpha: 0.14)
      : Colors.black.withValues(alpha: 0.12);

  /// Fixed bottom player height. Sized for a single Apple-Music-style row:
  /// artwork, two lines of text, and transport.
  static const double radioBarHeight = 74;

  /// Responsive breakpoints — mirrors web Tailwind tiers.
  static const double breakpointTablet = 600;
  static const double breakpointWide = 720;
  static const double breakpointDesktop = 1024;
  static const double maxContentWidth = 1100;

  static const double glassBlur = 20;
  static const double glassStrongBlur = 30;

  /// Canonical corner radii. Kept tight and consistent — sprawling radii
  /// (8/12/14/16/18/999 in the same view) were a big part of the old clutter.
  static const double cardRadius = 12;
  static const double tileRadius = 8;

  /// Album/track artwork, which reads best slightly softer than a card.
  static const double artworkRadius = 10;

  /// 4pt spacing scale. Use these instead of ad-hoc padding numbers.
  static const double space1 = 4;
  static const double space2 = 8;
  static const double space3 = 12;
  static const double space4 = 16;
  static const double space5 = 20;
  static const double space6 = 24;
  static const double space8 = 32;

  /// Opaque list-row / grid-cell surface.
  static BoxDecoration surfaceDecoration({
    BorderRadius? borderRadius,
    bool highlight = false,
  }) {
    return BoxDecoration(
      color: isDark ? _bgSurfaceDark : Colors.white,
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(
        color: highlight
            ? neonCyan.withValues(alpha: 0.55)
            : glassBorder,
        width: highlight ? 1.5 : 1,
      ),
      boxShadow: isDark ? null : _softShadow(6, 0.05),
    );
  }

  static BoxDecoration glassDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: isDark ? _bgSurfaceDark : Colors.white,
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(color: glassBorder),
      boxShadow: isDark ? null : _softShadow(10, 0.06),
    );
  }

  static BoxDecoration glassStrongDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: isDark
          ? _bgElevatedDark.withValues(alpha: 0.92)
          : Colors.white.withValues(alpha: 0.94),
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(color: glassBorderStrong),
      boxShadow: isDark ? null : _softShadow(14, 0.08),
    );
  }

  static List<BoxShadow> _softShadow(double blur, double alpha) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: alpha),
          blurRadius: blur,
          offset: Offset(0, blur / 3),
        ),
      ];

  /// Artwork lift. Replaces the old neon glow: album art gets a real shadow,
  /// nothing else does.
  static List<BoxShadow> artworkShadow({double blur = 28}) => [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.55 : 0.22),
          blurRadius: blur,
          offset: Offset(0, blur / 3.5),
        ),
      ];

  /// Historically a neon halo; now a neutral lift so existing call sites keep
  /// their sense of depth without the glow.
  static List<BoxShadow> glowCyan({double spread = 20}) =>
      artworkShadow(blur: spread);

  static List<BoxShadow> glowPink({double spread = 20}) =>
      artworkShadow(blur: spread);

  /// Glowing text does not belong in a music app — these are intentionally
  /// empty so every legacy call site renders flat.
  static List<Shadow> get textGlowCyan => const <Shadow>[];

  static List<Shadow> get textGlowPink => const <Shadow>[];
}
