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
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final scale = 0.85 + _controller.value * 0.3;
            return Container(
              width: widget.size * scale,
              height: widget.size * scale,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color,
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.7),
                    blurRadius: 8,
                    spreadRadius: 1,
                  ),
                ],
              ),
            );
          },
        ),
        if (widget.label != null) ...[
          const SizedBox(width: 6),
          Text(
            widget.label!,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
            ),
          ),
        ],
      ],
    );
  }
}
