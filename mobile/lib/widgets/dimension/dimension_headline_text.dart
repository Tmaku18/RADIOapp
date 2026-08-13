import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import 'dimension_typography.dart';

/// Hero headline emphasis. `cyanGlow` and `pinkGlitch` now both mean "this
/// word is the accent colour" — the glow and RGB-split treatments are gone.
enum DimensionHeadlineAccent { white, cyanGlow, pinkGlitch }

/// One line of a hero headline (`Join the`, `movement.`, etc.).
class DimensionHeadlineLine extends StatelessWidget {
  const DimensionHeadlineLine({
    super.key,
    required this.text,
    this.accent = DimensionHeadlineAccent.white,
    this.fontSize = 34,
  });

  final String text;
  final DimensionHeadlineAccent accent;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final color = accent == DimensionHeadlineAccent.white
        ? DimensionTokens.textPrimary
        : DimensionTokens.neonCyan;

    return Text(
      text,
      style: DimensionTypography.pageTitle(fontSize: fontSize)
          .copyWith(color: color, height: 1.1),
    );
  }
}

/// Section title with an accent word: `Trending` + `now`.
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
    DimensionTokens.watch(context);
    final base = DimensionTypography.pageTitle(fontSize: fontSize);

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: prefix, style: base),
          TextSpan(
            text: accent,
            style: base.copyWith(color: DimensionTokens.neonCyan),
          ),
        ],
      ),
    );
  }
}
