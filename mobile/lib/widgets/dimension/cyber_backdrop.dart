import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// The app's base canvas.
///
/// Screens throughout the app use a transparent [Scaffold] and rely on this to
/// paint their background, so it still fills the viewport — it just does it
/// quietly now. The animated grid and coloured orbs it used to draw competed
/// with album artwork on every single screen; a flat surface with a barely
/// perceptible vertical lift reads far cleaner and costs nothing to paint.
class CyberBackdrop extends StatelessWidget {
  const CyberBackdrop({super.key, this.bassLevel = 0});

  /// Retained for call-site compatibility. The backdrop no longer reacts to
  /// audio — a pulsing background behind a music app is noise, not feedback.
  final double bassLevel;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final base = DimensionTokens.bgBase;
    final isDark = DimensionTokens.isDark;

    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [
                    const Color(0xFF121214),
                    base,
                  ]
                : [
                    Colors.white,
                    const Color(0xFFF7F7FA),
                  ],
            stops: const [0.0, 0.45],
          ),
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}
