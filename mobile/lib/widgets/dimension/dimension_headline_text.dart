import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/dimension_tokens.dart';
import 'glitch_text.dart';

/// Hero + section headline accents matching web dimension.css utilities.
enum DimensionHeadlineAccent { white, cyanGlow, pinkGlitch }

/// Single hero headline line (`Join the`, `movement.`, etc.).
class DimensionHeadlineLine extends StatelessWidget {
  const DimensionHeadlineLine({
    super.key,
    required this.text,
    this.accent = DimensionHeadlineAccent.white,
    this.fontSize = 36,
  });

  final String text;
  final DimensionHeadlineAccent accent;
  final double fontSize;

  TextStyle _baseStyle() {
    return GoogleFonts.unbounded(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      height: 1.05,
      letterSpacing: -0.5,
    );
  }

  @override
  Widget build(BuildContext context) {
    switch (accent) {
      case DimensionHeadlineAccent.white:
        return Text(
          text,
          style: _baseStyle().copyWith(color: DimensionTokens.textPrimary),
        );
      case DimensionHeadlineAccent.cyanGlow:
        return _GradientGlowText(
          text: text,
          style: _baseStyle(),
          gradientColors: [DimensionTokens.cyan300, DimensionTokens.textPrimary],
          shadows: DimensionTokens.textGlowCyan,
        );
      case DimensionHeadlineAccent.pinkGlitch:
        return GlitchText(
          text: text,
          style: _baseStyle(),
          glowShadows: DimensionTokens.textGlowPink,
          gradientColors: [DimensionTokens.pink400, DimensionTokens.textPrimary],
        );
    }
  }
}

/// Section title with accent word: `Trending` + `now`.
class DimensionSectionTitle extends StatelessWidget {
  const DimensionSectionTitle({
    super.key,
    required this.prefix,
    required this.accent,
    this.accentIsPink = false,
    this.fontSize = 22,
  });

  final String prefix;
  final String accent;
  final bool accentIsPink;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final base = GoogleFonts.unbounded(
      color: DimensionTokens.textPrimary,
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      letterSpacing: -0.5,
    );

    final accentStyle = base.copyWith(
      color: accentIsPink ? DimensionTokens.pink400 : DimensionTokens.cyan300,
      shadows: accentIsPink
          ? DimensionTokens.textGlowPink
          : DimensionTokens.textGlowCyan,
    );

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: prefix, style: base),
          TextSpan(text: accent, style: accentStyle),
        ],
      ),
    );
  }
}

class _GradientGlowText extends StatelessWidget {
  const _GradientGlowText({
    required this.text,
    required this.style,
    required this.gradientColors,
    required this.shadows,
  });

  final String text;
  final TextStyle style;
  final List<Color> gradientColors;
  final List<Shadow> shadows;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: gradientColors,
      ).createShader(bounds),
      child: Text(
        text,
        style: style.copyWith(
          color: Colors.white,
          shadows: shadows,
        ),
      ),
    );
  }
}
