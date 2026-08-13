import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_theme.dart';

enum DimensionCtaVariant { primary, secondary, pink }

/// The app's pill button.
///
/// Previously an ALL-CAPS wide-tracked monospace label on a glowing neon fill.
/// Now: sentence case, the UI font, a solid accent fill for the primary action
/// and a hairline outline for everything else.
class DimensionCtaButton extends StatelessWidget {
  const DimensionCtaButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = DimensionCtaVariant.primary,
    this.expanded = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final DimensionCtaVariant variant;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final (Color bg, Color fg, Color border) = switch (variant) {
      DimensionCtaVariant.primary => (
          DimensionTokens.neonCyan,
          Colors.white,
          Colors.transparent,
        ),
      DimensionCtaVariant.secondary => (
          Colors.transparent,
          DimensionTokens.textPrimary,
          DimensionTokens.glassBorderStrong,
        ),
      DimensionCtaVariant.pink => (
          Colors.transparent,
          DimensionTokens.neonPink,
          DimensionTokens.neonPink.withValues(alpha: 0.55),
        ),
    };

    final child = Material(
      color: bg,
      elevation: 0,
      shape: StadiumBorder(side: BorderSide(color: border)),
      child: InkWell(
        onTap: onPressed,
        customBorder: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: kNetworxFontFamily,
              color: fg,
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
        ),
      ),
    );

    if (expanded) return SizedBox(width: double.infinity, child: child);
    return child;
  }
}
