import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import 'neon_line.dart';

/// A soft section break: an uppercase neon label above an animated [NeonLine],
/// replacing hard [Divider]s / plain section titles to match the web look.
///
/// Pass [trailing] for an action (e.g. "See all"). Keeps horizontal padding at
/// zero so callers control layout inside their own list padding.
class DimensionSectionHeader extends StatelessWidget {
  const DimensionSectionHeader({
    super.key,
    required this.title,
    this.trailing,
    this.color = DimensionTokens.cyan300,
    this.padding = const EdgeInsets.only(top: 20, bottom: 10),
  });

  final String title;
  final Widget? trailing;
  final Color color;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title.toUpperCase(),
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.6,
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 8),
          const NeonLine(),
        ],
      ),
    );
  }
}
