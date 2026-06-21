import 'package:flutter/material.dart';

/// NETWORX Dimension — Emergent 3D cyber aesthetic (integrate branch).
/// Mirrors web [dimension.css] tokens.
class DimensionTokens {
  static const Color bgBase = Color(0xFF050505);
  static const Color bgSurface = Color(0xFF0A0A0C);
  static const Color neonCyan = Color(0xFF00F0FF);
  static const Color neonPink = Color(0xFFFF007F);
  static const Color neonYellow = Color(0xFFF4D03F);
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFA0A0AB);
  static const Color textMuted = Color(0xFF5E5E66);

  /// Fixed bottom player height (web: DIMENSION_RADIO_BAR_HEIGHT).
  static const double radioBarHeight = 112;

  static const double glassBlur = 24;
  static const double glassStrongBlur = 40;

  static BoxDecoration glassDecoration({BorderRadius? borderRadius}) {
    return BoxDecoration(
      color: bgSurface.withValues(alpha: 0.55),
      borderRadius: borderRadius ?? BorderRadius.circular(16),
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
}
