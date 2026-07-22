import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dimension_tokens.dart';

/// Theme extension for Dimension / Emergent UI typography and surfaces.
class DimensionTheme extends ThemeExtension<DimensionTheme> {
  const DimensionTheme({
    required this.headlineStyle,
    required this.sectionLabelStyle,
    required this.monoLabelStyle,
    required this.bodyStyle,
    required this.glassColor,
    required this.glassStrongColor,
  });

  final TextStyle headlineStyle;
  final TextStyle sectionLabelStyle;
  final TextStyle monoLabelStyle;
  final TextStyle bodyStyle;
  final Color glassColor;
  final Color glassStrongColor;

  static DimensionTheme of(BuildContext context) {
    return Theme.of(context).extension<DimensionTheme>() ??
        (Theme.of(context).brightness == Brightness.light ? light() : dark());
  }

  static DimensionTheme dark() {
    DimensionTokens.bindBrightness(Brightness.dark);
    return DimensionTheme(
      headlineStyle: GoogleFonts.unbounded(
        color: DimensionTokens.textPrimary,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
      ),
      sectionLabelStyle: GoogleFonts.jetBrainsMono(
        color: DimensionTokens.cyan300,
        fontSize: 10,
        letterSpacing: 3.2,
        fontWeight: FontWeight.w500,
      ),
      monoLabelStyle: GoogleFonts.jetBrainsMono(
        color: DimensionTokens.textSecondary,
        fontSize: 10,
        letterSpacing: 2.5,
      ),
      bodyStyle: GoogleFonts.outfit(
        color: DimensionTokens.textSecondary,
        fontSize: 15,
        height: 1.5,
      ),
      glassColor: DimensionTokens.bgSurface.withValues(alpha: 0.55),
      glassStrongColor: const Color(0xFF08080A).withValues(alpha: 0.8),
    );
  }

  /// Web `.light [data-dimension]` — cool slate canvas, teal accents.
  static DimensionTheme light() {
    DimensionTokens.bindBrightness(Brightness.light);
    return DimensionTheme(
      headlineStyle: GoogleFonts.unbounded(
        color: DimensionTokens.textPrimary,
        fontWeight: FontWeight.w900,
        letterSpacing: -0.5,
      ),
      sectionLabelStyle: GoogleFonts.jetBrainsMono(
        color: DimensionTokens.cyan300,
        fontSize: 10,
        letterSpacing: 3.2,
        fontWeight: FontWeight.w500,
      ),
      monoLabelStyle: GoogleFonts.jetBrainsMono(
        color: DimensionTokens.textSecondary,
        fontSize: 10,
        letterSpacing: 2.5,
      ),
      bodyStyle: GoogleFonts.outfit(
        color: DimensionTokens.textSecondary,
        fontSize: 15,
        height: 1.5,
      ),
      glassColor: const Color(0xFFF1F5F9).withValues(alpha: 0.82),
      glassStrongColor: const Color(0xFFE2E8F0).withValues(alpha: 0.95),
    );
  }

  @override
  DimensionTheme copyWith({
    TextStyle? headlineStyle,
    TextStyle? sectionLabelStyle,
    TextStyle? monoLabelStyle,
    TextStyle? bodyStyle,
    Color? glassColor,
    Color? glassStrongColor,
  }) {
    return DimensionTheme(
      headlineStyle: headlineStyle ?? this.headlineStyle,
      sectionLabelStyle: sectionLabelStyle ?? this.sectionLabelStyle,
      monoLabelStyle: monoLabelStyle ?? this.monoLabelStyle,
      bodyStyle: bodyStyle ?? this.bodyStyle,
      glassColor: glassColor ?? this.glassColor,
      glassStrongColor: glassStrongColor ?? this.glassStrongColor,
    );
  }

  @override
  DimensionTheme lerp(ThemeExtension<DimensionTheme>? other, double t) {
    if (other is! DimensionTheme) return this;
    return DimensionTheme(
      headlineStyle: TextStyle.lerp(headlineStyle, other.headlineStyle, t)!,
      sectionLabelStyle:
          TextStyle.lerp(sectionLabelStyle, other.sectionLabelStyle, t)!,
      monoLabelStyle: TextStyle.lerp(monoLabelStyle, other.monoLabelStyle, t)!,
      bodyStyle: TextStyle.lerp(bodyStyle, other.bodyStyle, t)!,
      glassColor: Color.lerp(glassColor, other.glassColor, t)!,
      glassStrongColor:
          Color.lerp(glassStrongColor, other.glassStrongColor, t)!,
    );
  }
}
