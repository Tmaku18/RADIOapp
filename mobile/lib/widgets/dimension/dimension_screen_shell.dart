import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';
import 'cyber_backdrop.dart';
import 'dimension_typography.dart';
import 'neon_line.dart';

/// Standard screen chrome: base canvas, flat app bar, optional hairline rule.
class DimensionScreenShell extends StatelessWidget {
  const DimensionScreenShell({
    super.key,
    this.title,
    this.actions,
    this.leading,
    required this.body,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.showNeonLine = true,
    this.loading = false,
    this.centerTitle,
    this.backdrop,
  });

  final String? title;
  final List<Widget>? actions;
  final Widget? leading;
  final Widget body;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool showNeonLine;
  final bool loading;
  final bool? centerTitle;
  /// Full-screen background. Defaults to [CyberBackdrop].
  final Widget? backdrop;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final customBackdrop = backdrop;
    final scaffold = Scaffold(
      backgroundColor:
          customBackdrop != null ? Colors.transparent : DimensionTokens.bgBase,
      appBar: title == null
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              scrolledUnderElevation: 0,
              centerTitle: centerTitle,
              leading: leading,
              title: Text(
                title!,
                style: DimensionTypography.pageTitle(fontSize: 20),
              ),
              actions: actions,
            ),
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (customBackdrop == null)
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

    if (customBackdrop == null) return scaffold;
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(child: customBackdrop),
        scaffold,
      ],
    );
  }
}
