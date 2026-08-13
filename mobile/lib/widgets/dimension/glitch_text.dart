import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';
import 'dimension_typography.dart';

/// A headline.
///
/// This used to render three offset copies of the text in cyan, magenta and
/// white to fake an RGB-split glitch. It made headlines hard to read and
/// tripled the text layout work, so the effect is gone — the widget stays so
/// the marketing and hero screens keep compiling, and it now draws one crisp
/// line of type.
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

  /// Ignored. Kept so existing call sites compile.
  final List<Shadow>? glowShadows;

  /// Ignored. Kept so existing call sites compile.
  final List<Color>? gradientColors;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final base = style ?? DimensionTypography.pageTitle(fontSize: 32);

    return Text(
      text,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: base.copyWith(
        color: base.color ?? DimensionTokens.textPrimary,
        shadows: const <Shadow>[],
      ),
    );
  }
}
