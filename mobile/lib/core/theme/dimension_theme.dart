import 'package:flutter/material.dart';
import 'dimension_tokens.dart';
import 'networx_theme.dart';

/// Theme extension for shared typography and surface fills.
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

  static TextStyle _inter(
    double size,
    FontWeight weight, {
    double tracking = 0,
    double? height,
    required Color color,
  }) {
    return TextStyle(
      fontFamily: kNetworxFontFamily,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: tracking,
      height: height,
      color: color,
    );
  }

  static DimensionTheme _build(Brightness brightness) {
    DimensionTokens.bindBrightness(brightness);
    final isDark = brightness == Brightness.dark;
    return DimensionTheme(
      headlineStyle: _inter(
        28,
        FontWeight.w700,
        tracking: -0.6,
        height: 1.15,
        color: DimensionTokens.textPrimary,
      ),
      sectionLabelStyle: _inter(
        13,
        FontWeight.w600,
        color: DimensionTokens.textSecondary,
      ),
      monoLabelStyle: _inter(
        12,
        FontWeight.w500,
        tracking: 0.2,
        color: DimensionTokens.textMuted,
      ),
      bodyStyle: _inter(
        15,
        FontWeight.w400,
        height: 1.45,
        color: DimensionTokens.textSecondary,
      ),
      glassColor: isDark ? const Color(0xFF1C1C1E) : Colors.white,
      glassStrongColor:
          isDark ? const Color(0xFF2C2C2E) : const Color(0xFFF2F2F7),
    );
  }

  static DimensionTheme dark() => _build(Brightness.dark);

  static DimensionTheme light() => _build(Brightness.light);

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
