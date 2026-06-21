import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/dimension_tokens.dart';

enum DimensionCtaVariant { primary, secondary, pink }

/// Web Emergent CTA pills.
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
    final style = switch (variant) {
      DimensionCtaVariant.primary => _Style(
          bg: DimensionTokens.neonCyan,
          fg: Colors.black,
          border: Colors.transparent,
          glow: DimensionTokens.glowCyan(spread: 12),
        ),
      DimensionCtaVariant.secondary => _Style(
          bg: Colors.transparent,
          fg: DimensionTokens.textPrimary,
          border: Colors.white.withValues(alpha: 0.2),
          glow: const [],
        ),
      DimensionCtaVariant.pink => _Style(
          bg: Colors.transparent,
          fg: DimensionTokens.neonPink,
          border: DimensionTokens.neonPink,
          glow: DimensionTokens.glowPink(spread: 12),
        ),
    };

    final child = Material(
      color: style.bg,
      elevation: 0,
      shadowColor: Colors.transparent,
      shape: StadiumBorder(side: BorderSide(color: style.border)),
      child: InkWell(
        onTap: onPressed,
        customBorder: const StadiumBorder(),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          decoration: BoxDecoration(
            boxShadow: style.glow,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label.toUpperCase(),
            textAlign: TextAlign.center,
            style: GoogleFonts.jetBrainsMono(
              color: style.fg,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.5,
            ),
          ),
        ),
      ),
    );

    if (expanded) return SizedBox(width: double.infinity, child: child);
    return child;
  }
}

class _Style {
  const _Style({
    required this.bg,
    required this.fg,
    required this.border,
    required this.glow,
  });

  final Color bg;
  final Color fg;
  final Color border;
  final List<BoxShadow> glow;
}
