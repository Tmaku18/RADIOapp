import 'dart:ui';

import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: `.glass`
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.borderRadius,
    this.strong = false,
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final BorderRadius? borderRadius;
  final bool strong;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final radius = borderRadius ?? BorderRadius.circular(16);
    final decoration = strong
        ? DimensionTokens.glassStrongDecoration(borderRadius: radius)
        : DimensionTokens.glassDecoration(borderRadius: radius);
    final blur = strong ? DimensionTokens.glassStrongBlur : DimensionTokens.glassBlur;
    final padded = Padding(
      padding: padding ?? const EdgeInsets.all(16),
      child: child,
    );

    // Light mode skips backdrop blur — frosted glass over dark orbs made
    // slate text unreadable. Dark mode keeps the glass effect.
    Widget content = ClipRRect(
      borderRadius: radius,
      child: DimensionTokens.isDark
          ? BackdropFilter(
              filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
              child: DecoratedBox(decoration: decoration, child: padded),
            )
          : DecoratedBox(decoration: decoration, child: padded),
    );

    if (onTap != null) {
      content = Material(
        color: Colors.transparent,
        child: InkWell(onTap: onTap, borderRadius: radius, child: content),
      );
    }

    return content;
  }
}

/// Web: `.glass-strong` — nav, footer, player bar.
class GlassStrong extends GlassCard {
  const GlassStrong({
    super.key,
    required super.child,
    super.padding,
    super.borderRadius,
    super.onTap,
  }) : super(strong: true);
}
