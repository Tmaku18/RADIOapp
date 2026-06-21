import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/dimension_tokens.dart';

/// Simplified web `.glitch` RGB-split headline.
class GlitchText extends StatelessWidget {
  const GlitchText({
    super.key,
    required this.text,
    this.style,
    this.maxLines,
  });

  final String text;
  final TextStyle? style;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    final base = style ??
        GoogleFonts.unbounded(
          color: DimensionTokens.textPrimary,
          fontWeight: FontWeight.w900,
          fontSize: 32,
          height: 1.1,
        );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Transform.translate(
          offset: const Offset(-1.5, 0),
          child: Text(
            text,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: base.copyWith(
              color: DimensionTokens.neonCyan.withValues(alpha: 0.55),
            ),
          ),
        ),
        Transform.translate(
          offset: const Offset(1.5, 0),
          child: Text(
            text,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: base.copyWith(
              color: DimensionTokens.neonPink.withValues(alpha: 0.55),
            ),
          ),
        ),
        Text(
          text,
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
          style: base,
        ),
      ],
    );
  }
}
