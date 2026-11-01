import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Tiny equalizer drawn in code so the mini player shows motion without a
/// Lottie asset.
class NowPlayingBars extends StatefulWidget {
  const NowPlayingBars({super.key, this.height = 16, this.color});

  final double height;
  final Color? color;

  @override
  State<NowPlayingBars> createState() => _NowPlayingBarsState();
}

class _NowPlayingBarsState extends State<NowPlayingBars>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final color = widget.color ?? Theme.of(context).colorScheme.primary;
    if (reduce) {
      return Icon(Icons.graphic_eq, size: widget.height, color: color);
    }
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: List.generate(3, (i) {
            final t = (_controller.value + i * 0.22) % 1;
            final h = widget.height * (0.35 + 0.65 * math.sin(t * math.pi));
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: Container(
                width: 3,
                height: h,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
