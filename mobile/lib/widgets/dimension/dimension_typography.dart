import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_theme.dart';

/// Shared text styles. One family (Inter), weight and tracking carry the
/// hierarchy — no second display face, no glow, no wide-tracked mono labels.
class DimensionTypography {
  DimensionTypography._();

  static TextStyle _inter(
    double size,
    FontWeight weight, {
    double tracking = 0,
    double? height,
    Color? color,
  }) {
    return TextStyle(
      fontFamily: kNetworxFontFamily,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: tracking,
      height: height,
      color: color ?? DimensionTokens.textPrimary,
    );
  }

  static TextStyle pageTitle({double fontSize = 28}) =>
      _inter(fontSize, FontWeight.w700, tracking: -0.6, height: 1.15);

  static TextStyle pageSubtitle({double fontSize = 15}) => _inter(
        fontSize,
        FontWeight.w400,
        height: 1.45,
        color: DimensionTokens.textSecondary,
      );

  static TextStyle cardTitle({double fontSize = 17}) =>
      _inter(fontSize, FontWeight.w600, tracking: -0.3, height: 1.25);

  /// Small grouped-list header, e.g. "Recently Played".
  static TextStyle sectionLabel({Color? color}) => _inter(
        13,
        FontWeight.w600,
        tracking: 0,
        color: color ?? DimensionTokens.textSecondary,
      );

  static TextStyle body({Color? color, double fontSize = 15}) => _inter(
        fontSize,
        FontWeight.w400,
        height: 1.45,
        color: color ?? DimensionTokens.textSecondary,
      );

  static TextStyle bodyPrimary({double fontSize = 15}) =>
      body(color: DimensionTokens.textPrimary, fontSize: fontSize);

  static TextStyle bodyMuted({double fontSize = 13}) =>
      body(color: DimensionTokens.textMuted, fontSize: fontSize);

  /// Metadata that used to be wide-tracked monospace. Now a plain caption —
  /// still quiet, but readable at a glance.
  static TextStyle monoCaps({Color? color, double fontSize = 12}) => _inter(
        fontSize,
        FontWeight.w500,
        tracking: 0.2,
        color: color ?? DimensionTokens.textMuted,
      );

  /// Tabular figures for durations and counters so digits stop jittering.
  static TextStyle numeric({double fontSize = 12, Color? color}) => _inter(
        fontSize,
        FontWeight.w500,
        color: color ?? DimensionTokens.textMuted,
      ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]);

  static TextStyle statValue({double fontSize = 22}) =>
      _inter(fontSize, FontWeight.w700, tracking: -0.5);

  static TextStyle accentCyan({double fontSize = 17}) => _inter(
        fontSize,
        FontWeight.w600,
        tracking: -0.3,
        color: DimensionTokens.neonCyan,
      );

  static TextStyle accentPink({double fontSize = 17}) => _inter(
        fontSize,
        FontWeight.w600,
        tracking: -0.3,
        color: DimensionTokens.pink400,
      );
}
