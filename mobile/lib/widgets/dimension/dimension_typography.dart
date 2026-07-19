import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/dimension_tokens.dart';

/// Web dimension.css typography — Unbounded / Outfit / JetBrains Mono.
class DimensionTypography {
  DimensionTypography._();

  static TextStyle pageTitle({double fontSize = 24}) {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      letterSpacing: -0.5,
      height: 1.05,
      color: DimensionTokens.textPrimary,
    );
  }

  static TextStyle pageSubtitle({double fontSize = 15}) {
    return GoogleFonts.outfit(
      fontSize: fontSize,
      height: 1.5,
      color: DimensionTokens.textSecondary,
    );
  }

  static TextStyle cardTitle({double fontSize = 18}) {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.3,
      height: 1.1,
      color: DimensionTokens.textPrimary,
    );
  }

  static TextStyle sectionLabel({Color? color}) {
    return GoogleFonts.jetBrainsMono(
      fontSize: 10,
      letterSpacing: 3.2,
      fontWeight: FontWeight.w500,
      color: color ?? DimensionTokens.cyan300,
    );
  }

  static TextStyle body({Color? color, double fontSize = 15}) {
    return GoogleFonts.outfit(
      fontSize: fontSize,
      height: 1.5,
      color: color ?? DimensionTokens.textSecondary,
    );
  }

  static TextStyle bodyPrimary({double fontSize = 15}) {
    return body(color: DimensionTokens.textPrimary, fontSize: fontSize);
  }

  static TextStyle bodyMuted({double fontSize = 13}) {
    return body(color: DimensionTokens.textMuted, fontSize: fontSize);
  }

  static TextStyle monoCaps({Color? color, double fontSize = 10}) {
    return GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      letterSpacing: 2,
      fontWeight: FontWeight.w600,
      color: color ?? DimensionTokens.textMuted,
    );
  }

  static TextStyle statValue({double fontSize = 20}) {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      color: DimensionTokens.cyan300,
      shadows: DimensionTokens.textGlowCyan,
    );
  }

  static TextStyle accentCyan({double fontSize = 18}) {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      color: DimensionTokens.cyan300,
      shadows: DimensionTokens.textGlowCyan,
    );
  }

  static TextStyle accentPink({double fontSize = 18}) {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      color: DimensionTokens.pink400,
      shadows: DimensionTokens.textGlowPink,
    );
  }
}
