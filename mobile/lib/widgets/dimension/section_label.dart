import 'package:flutter/material.dart';
import '../../core/theme/dimension_theme.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: `◤ SECTION NN — NAME` mono pattern.
class SectionLabel extends StatelessWidget {
  const SectionLabel({
    super.key,
    required this.number,
    required this.title,
    this.color = DimensionTokens.neonCyan,
  });

  final String number;
  final String title;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final dim = DimensionTheme.of(context);
    return Text(
      '◤ SECTION $number — $title',
      style: dim.sectionLabelStyle.copyWith(color: color),
    );
  }
}
