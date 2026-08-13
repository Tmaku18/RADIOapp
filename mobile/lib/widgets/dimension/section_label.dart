import 'package:flutter/material.dart';
import '../../core/theme/dimension_theme.dart';
import '../../core/theme/dimension_tokens.dart';

/// A small label above a block of content.
///
/// Previously rendered as `◤ SECTION 03 — DISCOVER` in wide-tracked monospace.
/// The numbering and glyph were decoration; the label now just says what the
/// section is.
class SectionLabel extends StatelessWidget {
  const SectionLabel({
    super.key,
    required this.number,
    required this.title,
    this.color,
  });

  /// Retained for call-site compatibility; no longer displayed.
  final String number;
  final String title;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final dim = DimensionTheme.of(context);
    return Text(
      title,
      style: dim.sectionLabelStyle
          .copyWith(color: color ?? DimensionTokens.textSecondary),
    );
  }
}
