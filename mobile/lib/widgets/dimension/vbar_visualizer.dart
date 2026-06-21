import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: `.vbar` equalizer bars.
class VbarVisualizer extends StatefulWidget {
  const VbarVisualizer({
    super.key,
    this.barCount = 9,
    this.isPlaying = false,
    this.height = 28,
  });

  final int barCount;
  final bool isPlaying;
  final double height;

  @override
  State<VbarVisualizer> createState() => _VbarVisualizerState();
}

class _VbarVisualizerState extends State<VbarVisualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  static const _delays = [0.1, 0.3, 0.2, 0.4, 0.25, 0.35, 0.15, 0.5, 0.2];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _syncAnimation();
  }

  @override
  void didUpdateWidget(covariant VbarVisualizer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isPlaying != widget.isPlaying) _syncAnimation();
  }

  void _syncAnimation() {
    if (widget.isPlaying) {
      if (!_controller.isAnimating) _controller.repeat(reverse: true);
    } else {
      _controller.stop();
      _controller.value = 0.3;
    }
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
        return SizedBox(
          height: widget.height,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(widget.barCount, (i) {
              final delay = _delays[i % _delays.length];
              final phase = (_controller.value + delay) % 1.0;
              final scale = widget.isPlaying
                  ? 0.25 + math.sin(phase * math.pi * 2) * 0.35 + 0.4
                  : 0.2;
              return Container(
                width: 3,
                height: widget.height * scale.clamp(0.15, 1.0),
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      DimensionTokens.neonCyan,
                      DimensionTokens.neonPink,
                    ],
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }
}
