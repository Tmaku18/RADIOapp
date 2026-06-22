import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import 'dimension_typography.dart';

/// Web parity: pill link back to Networx Radio from Pro-Networx surfaces.
class BackToNetworxRadioButton extends StatelessWidget {
  const BackToNetworxRadioButton({
    super.key,
    this.compact = false,
    this.authenticatedTarget = false,
  });

  /// Hide the label on narrow headers (shows icon + "Radio" only).
  final bool compact;

  /// When true, signed-in users land on [AppRoutes.home] instead of welcome.
  final bool authenticatedTarget;

  void _navigate(BuildContext context) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    Navigator.of(context).pushNamedAndRemoveUntil(
      authenticatedTarget ? AppRoutes.home : AppRoutes.welcome,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final labelStyle = DimensionTypography.monoCaps(
      color: DimensionTokens.cyan300,
      fontSize: 10,
    );

    if (compact) {
      return TextButton.icon(
        onPressed: () => _navigate(context),
        icon: Icon(Icons.arrow_back, size: 16, color: DimensionTokens.cyan300),
        label: Text('Radio', style: labelStyle),
      );
    }

    return OutlinedButton.icon(
      onPressed: () => _navigate(context),
      style: OutlinedButton.styleFrom(
        foregroundColor: DimensionTokens.cyan300,
        side: BorderSide(color: DimensionTokens.cyan300.withValues(alpha: 0.4)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        visualDensity: VisualDensity.compact,
      ),
      icon: const Icon(Icons.radio_outlined, size: 16),
      label: Text('Back to Networx Radio', style: labelStyle),
    );
  }
}
