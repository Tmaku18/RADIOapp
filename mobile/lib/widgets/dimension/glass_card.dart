import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// A plain content card.
///
/// Named for the frosted-glass treatment it used to carry. The blur is gone:
/// stacking translucent panels over a busy backdrop cost a full-screen
/// `BackdropFilter` per card and left text sitting on whatever colour happened
/// to be behind it. These are now opaque surfaces with a hairline border.
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

  /// Renders one elevation step up — used for sheets and the player bar.
  final bool strong;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final radius =
        borderRadius ?? BorderRadius.circular(DimensionTokens.cardRadius);
    final decoration = strong
        ? DimensionTokens.glassStrongDecoration(borderRadius: radius)
        : DimensionTokens.glassDecoration(borderRadius: radius);

    Widget content = DecoratedBox(
      decoration: decoration,
      child: Padding(
        padding: padding ?? const EdgeInsets.all(DimensionTokens.space4),
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

    return ClipRRect(borderRadius: radius, child: content);
  }
}

/// One elevation step up — nav, sheets, player bar.
class GlassStrong extends GlassCard {
  const GlassStrong({
    super.key,
    required super.child,
    super.padding,
    super.borderRadius,
    super.onTap,
  }) : super(strong: true);
}
