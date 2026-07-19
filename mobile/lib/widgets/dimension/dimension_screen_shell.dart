import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import 'cyber_backdrop.dart';
import 'dimension_typography.dart';
import 'neon_line.dart';

/// Dimension marketing/listen screen chrome — cyber backdrop + dark base.
class DimensionScreenShell extends StatelessWidget {
  const DimensionScreenShell({
    super.key,
    this.title,
    this.actions,
    required this.body,
    this.floatingActionButton,
    this.showNeonLine = false,
    this.loading = false,
  });

  final String? title;
  final List<Widget>? actions;
  final Widget body;
  final Widget? floatingActionButton;
  final bool showNeonLine;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DimensionTokens.bgBase,
      appBar: title == null
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              title: Text(title!, style: DimensionTypography.pageTitle(fontSize: 18)),
              actions: actions,
            ),
      floatingActionButton: floatingActionButton,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: CyberBackdrop()),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (showNeonLine) const NeonLine(),
                Expanded(child: body),
              ],
            ),
        ],
      ),
    );
  }
}
