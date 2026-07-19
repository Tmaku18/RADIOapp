import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';

/// A translucent, NO-BLUR surface for list rows and grid cells.
///
/// Visually matches [GlassCard] (semi-transparent fill + soft border + rounded
/// corners) and lets the [CyberBackdrop] glow show through, but skips the
/// per-item [BackdropFilter] blur so long scrolling lists (feed, discover,
/// library) stay smooth. Use [GlassCard] for hero / non-list panels where the
/// real blur is worth it.
class DimensionSurface extends StatelessWidget {
  const DimensionSurface({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius,
    this.highlight = false,
    this.onTap,
    this.margin,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final BorderRadius? borderRadius;
  final bool highlight;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final radius =
        borderRadius ?? BorderRadius.circular(DimensionTokens.cardRadius);

    Widget content = DecoratedBox(
      decoration: DimensionTokens.surfaceDecoration(
        borderRadius: radius,
        highlight: highlight,
      ),
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16),
        child: child,
      ),
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radius,
          child: content,
        ),
      );
    }

    if (margin != null) {
      content = Padding(padding: margin!, child: content);
    }

    return content;
  }
}
