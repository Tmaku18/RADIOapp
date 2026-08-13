import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import 'dimension_typography.dart';

/// A section heading, in the style of a grouped music library: a bold
/// title-case line with an optional trailing action, and nothing else.
///
/// It used to be an uppercase wide-tracked accent label sitting on an animated
/// gradient rule, which drew more attention than the content beneath it.
class DimensionSectionHeader extends StatelessWidget {
  const DimensionSectionHeader({
    super.key,
    required this.title,
    this.trailing,
    this.color,
    this.padding = const EdgeInsets.only(top: 24, bottom: 10),
  });

  final String title;
  final Widget? trailing;
  final Color? color;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(
              title,
              style: DimensionTypography.cardTitle(fontSize: 22).copyWith(
                fontWeight: FontWeight.w700,
                color: color ?? DimensionTokens.textPrimary,
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
