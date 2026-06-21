import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/dimension_tokens.dart';

/// FFT-style frequency bars — web FrequencyVisualizer parity.
class FrequencyVisualizer extends StatefulWidget {
  const FrequencyVisualizer({super.key, required this.isPlaying});

  final bool isPlaying;

  @override
  State<FrequencyVisualizer> createState() => _FrequencyVisualizerState();
}

class _FrequencyVisualizerState extends State<FrequencyVisualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  final _rand = math.Random(7);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _sync();
  }

  @override
  void didUpdateWidget(covariant FrequencyVisualizer oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    if (widget.isPlaying) {
      _controller.repeat(reverse: true);
    } else {
      _controller.stop();
      _controller.value = 0.2;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.isPlaying ? 'LIVE FFT' : 'STANDBY',
          style: TextStyle(
            color: widget.isPlaying
                ? DimensionTokens.neonCyan
                : DimensionTokens.textMuted,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return SizedBox(
              height: 48,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(24, (i) {
                  final noise = _rand.nextDouble();
                  final h = widget.isPlaying
                      ? 0.2 +
                          math.sin((_controller.value + i * 0.08) * math.pi * 2) *
                              0.35 +
                          noise * 0.25
                      : 0.15;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 1),
                      child: Container(
                        height: 48 * h.clamp(0.1, 1.0),
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
                      ),
                    ),
                  );
                }),
              ),
            );
          },
        ),
      ],
    );
  }
}
