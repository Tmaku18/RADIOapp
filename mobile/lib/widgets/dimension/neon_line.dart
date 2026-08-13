import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// A hairline separator.
///
/// This used to sweep an animated cyan-to-pink gradient across the top of the
/// player bar and every section header. A permanently animating accent line is
/// the kind of thing you notice once and then fight forever, so it is now a
/// still, single-pixel rule in the theme's divider colour.
class NeonLine extends StatelessWidget {
  const NeonLine({super.key, this.height = 1});

  final double height;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    return SizedBox(
      height: height,
      child: ColoredBox(color: DimensionTokens.glassBorder),
    );
  }
}
