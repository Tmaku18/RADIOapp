import 'package:flutter/material.dart';

/// NETWORX Dimension — Emergent 3D cyber aesthetic (integrate branch).
/// Mirrors web [dimension.css] tokens.
class DimensionTokens {
  static const Color bgBase = Color(0xFF050505);
  static const Color bgSurface = Color(0xFF0A0A0C);
  static const Color neonCyan = Color(0xFF00F0FF);
  static const Color neonPink = Color(0xFFFF007F);
  static const Color neonYellow = Color(0xFFF4D03F);
  /// Tailwind cyan-300 / web `text-cyan-300`
  static const Color cyan300 = Color(0xFF67E8F9);
  /// Tailwind pink-400 / web `text-pink-400`
  static const Color pink400 = Color(0xFFF472B6);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFA0A0AB);
  static const Color textMuted = Color(0xFF5E5E66);

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
  /// Use these instead of ad-hoc small values so nothing reads as "square".
  static const double cardRadius = 16;
  static const double tileRadius = 12;

  /// Translucent, NO-BLUR surface for list rows/grid cells. Reads like glass
  /// (semi-transparent fill + soft border) and lets the [CyberBackdrop] glow
  /// show through, without the per-item [BackdropFilter] cost that makes long
  /// scrolling lists janky. Reserve the real blur [glassDecoration] for hero /
  /// non-list panels.
  static BoxDecoration surfaceDecoration({
    BorderRadius? borderRadius,
    bool highlight = false,
  }) {
    return BoxDecoration(
      color: bgSurface.withValues(alpha: 0.62),
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(
        color: highlight
            ? neonCyan.withValues(alpha: 0.35)
            : Colors.white.withValues(alpha: 0.08),
      ),
    );
  }

  static BoxDecoration glassDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: bgSurface.withValues(alpha: 0.55),
      borderRadius: borderRadius ?? BorderRadius.circular(cardRadius),
      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
    );
  }

  static BoxDecoration glassStrongDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: const Color(0xFF08080A).withValues(alpha: 0.8),
      borderRadius: borderRadius ?? BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
    );
  }

  static List<BoxShadow> glowCyan({double spread = 20}) => [
        BoxShadow(
          color: neonCyan.withValues(alpha: 0.35),
          blurRadius: spread,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: neonCyan.withValues(alpha: 0.15),
          blurRadius: spread * 3,
          spreadRadius: 0,
        ),
      ];

  static List<BoxShadow> glowPink({double spread = 20}) => [
        BoxShadow(
          color: neonPink.withValues(alpha: 0.35),
          blurRadius: spread,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: neonPink.withValues(alpha: 0.15),
          blurRadius: spread * 3,
          spreadRadius: 0,
        ),
      ];

  /// Web `[data-dimension] .text-glow-cyan`
  static List<Shadow> textGlowCyan = [
    Shadow(color: neonCyan.withValues(alpha: 0.7), blurRadius: 14),
  ];

  /// Web `[data-dimension] .text-glow-pink`
  static List<Shadow> textGlowPink = [
    Shadow(color: neonPink.withValues(alpha: 0.8), blurRadius: 14),
  ];
}
