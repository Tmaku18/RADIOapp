import 'package:flutter/material.dart';

/// NETWORX Dimension — Emergent 3D cyber aesthetic.
/// Mirrors web [dimension.css] tokens for dark and `.light [data-dimension]`.
///
/// Call [bindBrightness] from the app [MaterialApp.builder] so static getters
/// track ThemeMode without threading [BuildContext] through every call site.
class DimensionTokens {
  DimensionTokens._();

  static Brightness _brightness = Brightness.dark;

  /// Keep Dimension chrome in sync with Material brightness.
  static void bindBrightness(Brightness brightness) {
    _brightness = brightness;
  }

  static bool get isDark => _brightness == Brightness.dark;

  // —— Dark (web `:root` / `[data-dimension]`) ——
  static const Color _bgBaseDark = Color(0xFF050505);
  static const Color _bgSurfaceDark = Color(0xFF0A0A0C);
  static const Color _neonCyanDark = Color(0xFF00F0FF);
  static const Color _neonPinkDark = Color(0xFFFF007F);
  static const Color _neonYellowDark = Color(0xFFF4D03F);
  static const Color _cyan300Dark = Color(0xFF67E8F9);
  static const Color _pink400Dark = Color(0xFFF472B6);
  static const Color _textPrimaryDark = Color(0xFFFFFFFF);
  static const Color _textSecondaryDark = Color(0xFFA0A0AB);
  static const Color _textMutedDark = Color(0xFF5E5E66);
  static const Color _glassStrongDark = Color(0xFF08080A);

  // —— Light (web `.light [data-dimension]` + dashboard `.light`) ——
  static const Color _bgBaseLight = Color(0xFFE8EDF4);
  static const Color _bgSurfaceLight = Color(0xFFF1F5F9);
  static const Color _neonCyanLight = Color(0xFF0E7490);
  static const Color _neonPinkLight = Color(0xFFBE185D);
  static const Color _neonYellowLight = Color(0xFFB45309);
  static const Color _cyan300Light = Color(0xFF0E9AA7);
  static const Color _pink400Light = Color(0xFFBE185D);
  static const Color _textPrimaryLight = Color(0xFF0F172A);
  static const Color _textSecondaryLight = Color(0xFF334155);
  static const Color _textMutedLight = Color(0xFF64748B);
  static const Color _glassStrongLight = Color(0xFFE2E8F0);

  static Color get bgBase => isDark ? _bgBaseDark : _bgBaseLight;
  static Color get bgSurface => isDark ? _bgSurfaceDark : _bgSurfaceLight;
  static Color get neonCyan => isDark ? _neonCyanDark : _neonCyanLight;
  static Color get neonPink => isDark ? _neonPinkDark : _neonPinkLight;
  static Color get neonYellow => isDark ? _neonYellowDark : _neonYellowLight;
  static Color get cyan300 => isDark ? _cyan300Dark : _cyan300Light;
  static Color get pink400 => isDark ? _pink400Dark : _pink400Light;
  static Color get textPrimary =>
      isDark ? _textPrimaryDark : _textPrimaryLight;
  static Color get textSecondary =>
      isDark ? _textSecondaryDark : _textSecondaryLight;
  static Color get textMuted => isDark ? _textMutedDark : _textMutedLight;

  /// Fade color used by [CyberBackdrop] radial wash.
  static Color get backdropFade => isDark ? Colors.black : _bgBaseLight;

  /// Border used on glass / surfaces (white hairline in dark, teal in light).
  static Color get glassBorder => isDark
      ? Colors.white.withValues(alpha: 0.08)
      : const Color(0xFF0E7490).withValues(alpha: 0.16);

  static Color get glassBorderStrong => isDark
      ? Colors.white.withValues(alpha: 0.10)
      : const Color(0xFF0E7490).withValues(alpha: 0.22);

  /// Fixed bottom player height (web: DIMENSION_RADIO_BAR_HEIGHT).
  static const double radioBarHeight = 112;

  /// Responsive breakpoints — mirrors web Tailwind tiers.
  static const double breakpointTablet = 600;
  static const double breakpointWide = 720;
  static const double breakpointDesktop = 1024;
  static const double maxContentWidth = 1100;

  static const double glassBlur = 24;
  static const double glassStrongBlur = 40;

  /// Canonical corner radii — web parity (cards ~16, tiles/thumbnails ~12).
  static const double cardRadius = 16;
  static const double tileRadius = 12;

  /// Translucent, NO-BLUR surface for list rows/grid cells.
  static BoxDecoration surfaceDecoration({
    BorderRadius? borderRadius,
    bool highlight = false,
  }) {
    return BoxDecoration(
      color: isDark
          ? bgSurface.withValues(alpha: 0.62)
          : Colors.white.withValues(alpha: 0.88),
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(
        color: highlight
            ? neonCyan.withValues(alpha: isDark ? 0.35 : 0.28)
            : glassBorder,
      ),
      boxShadow: isDark
          ? null
          : [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
    );
  }

  static BoxDecoration glassDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: isDark
          ? bgSurface.withValues(alpha: 0.55)
          : const Color(0xFFF1F5F9).withValues(alpha: 0.82),
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(color: glassBorder),
      boxShadow: isDark
          ? null
          : [
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.8),
                blurRadius: 0,
                offset: const Offset(0, 1),
                spreadRadius: 0,
              ),
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.05),
                blurRadius: 32,
                offset: const Offset(0, 8),
              ),
            ],
    );
  }

  static BoxDecoration glassStrongDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: isDark
          ? _glassStrongDark.withValues(alpha: 0.8)
          : _glassStrongLight.withValues(alpha: 0.95),
      gradient: isDark
          ? null
          : LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFFE2E8F0).withValues(alpha: 0.97),
                const Color(0xFFF1F5F9).withValues(alpha: 0.94),
              ],
            ),
      borderRadius: borderRadius ?? BorderRadius.circular(16),
      border: Border.all(color: glassBorderStrong),
      boxShadow: isDark
          ? null
          : [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                blurRadius: 24,
                offset: const Offset(0, 4),
              ),
            ],
    );
  }

  static List<BoxShadow> glowCyan({double spread = 20}) => [
        BoxShadow(
          color: neonCyan.withValues(alpha: isDark ? 0.35 : 0.20),
          blurRadius: spread,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: neonCyan.withValues(alpha: isDark ? 0.15 : 0.08),
          blurRadius: spread * 3,
          spreadRadius: 0,
        ),
      ];

  static List<BoxShadow> glowPink({double spread = 20}) => [
        BoxShadow(
          color: neonPink.withValues(alpha: isDark ? 0.35 : 0.20),
          blurRadius: spread,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: neonPink.withValues(alpha: isDark ? 0.15 : 0.08),
          blurRadius: spread * 3,
          spreadRadius: 0,
        ),
      ];

  /// Web `[data-dimension] .text-glow-cyan`
  static List<Shadow> get textGlowCyan => [
        Shadow(
          color: neonCyan.withValues(alpha: isDark ? 0.7 : 0.25),
          blurRadius: isDark ? 14 : 10,
        ),
      ];

  /// Web `[data-dimension] .text-glow-pink`
  static List<Shadow> get textGlowPink => [
        Shadow(
          color: neonPink.withValues(alpha: isDark ? 0.8 : 0.25),
          blurRadius: isDark ? 14 : 10,
        ),
      ];
}
