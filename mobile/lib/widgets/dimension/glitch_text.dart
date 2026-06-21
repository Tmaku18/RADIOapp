import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web `.glitch` + `.text-glow-pink` RGB-split headline.
class GlitchText extends StatelessWidget {
  const GlitchText({
    super.key,
    required this.text,
    this.style,
    this.maxLines,
    this.glowShadows,
    this.gradientColors,
  });

  final String text;
  final TextStyle? style;
  final int? maxLines;
  final List<Shadow>? glowShadows;
  final List<Color>? gradientColors;

  @override
  Widget build(BuildContext context) {
    final base = style ??
        GoogleFonts.unbounded(
          color: DimensionTokens.textPrimary,
          fontWeight: FontWeight.w900,
          fontSize: 32,
          height: 1.1,
        );

    final mainStyle = base.copyWith(
      color: DimensionTokens.textPrimary,
      shadows: glowShadows ?? DimensionTokens.textGlowPink,
    );

    Widget mainText = Text(
      text,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: mainStyle,
    );

    if (gradientColors != null && gradientColors!.length >= 2) {
      mainText = ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: gradientColors!,
        ).createShader(bounds),
        child: Text(
          text,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
          style: mainStyle.copyWith(color: Colors.white),
        ),
      );
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Transform.translate(
          offset: const Offset(-2, 0),
          child: Text(
            text,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: base.copyWith(
              color: DimensionTokens.neonCyan.withValues(alpha: 0.75),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(2, 0),
          child: Text(
            text,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: base.copyWith(
              color: DimensionTokens.neonPink.withValues(alpha: 0.75),
            ),
          ),
        ),
        mainText,
      ],
    );
  }
}
