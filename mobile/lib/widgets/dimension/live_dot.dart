import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: `.live-dot` — pulsing pink live indicator.
///
/// [color] overrides the pink for non-live states, e.g. the amber shown while
/// the radio is reconnecting.
class LiveDot extends StatefulWidget {
  const LiveDot({super.key, this.size = 8, this.label, this.color});

  final double size;
  final String? label;
  final Color? color;

  @override
  State<LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? DimensionTokens.neonPink;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // A gentle opacity breath reads as "live" without the halo and the
        // size jump, which made the whole row reflow every frame.
        FadeTransition(
          opacity: _controller.drive(Tween(begin: 0.45, end: 1.0)),
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
        ),
        if (widget.label != null) ...[
          const SizedBox(width: 6),
          Text(
            widget.label!,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ],
    );
  }
}
