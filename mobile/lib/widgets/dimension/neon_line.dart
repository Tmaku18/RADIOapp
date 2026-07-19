import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: `.neon-line` — animated gradient sweep on top edge.
class NeonLine extends StatefulWidget {
  const NeonLine({super.key, this.height = 1});

  final double height;

  @override
  State<NeonLine> createState() => _NeonLineState();
}

class _NeonLineState extends State<NeonLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          height: widget.height,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment(_controller.value * 2 - 1, 0),
              end: Alignment(_controller.value * 2, 0),
              colors: [
                Colors.transparent,
                DimensionTokens.neonCyan.withValues(alpha: 0.6),
                DimensionTokens.neonPink.withValues(alpha: 0.6),
                Colors.transparent,
              ],
            ),
          ),
        );
      },
    );
  }
}
