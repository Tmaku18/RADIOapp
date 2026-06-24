import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/theme/dimension_tokens.dart';

/// FFT-style frequency bars — web FrequencyVisualizer parity.
///
/// Real device FFT isn't available through the background audio pipeline, so
/// this draws a music-like simulated spectrum (bass-heavy, beat pulse, per-bar
/// wobble) while playing and a calm idle wave when paused. A continuous ticker
/// drives it so it stays alive regardless of parent rebuilds.
class FrequencyVisualizer extends StatefulWidget {
  const FrequencyVisualizer({super.key, required this.isPlaying});

  final bool isPlaying;

  @override
  State<FrequencyVisualizer> createState() => _FrequencyVisualizerState();
}

class _FrequencyVisualizerState extends State<FrequencyVisualizer>
    with SingleTickerProviderStateMixin {
  static const _barCount = 24;
  static const _maxHeight = 48.0;

  late final Ticker _ticker;
  double _t = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      setState(() => _t = elapsed.inMicroseconds / 1e6);
    })..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  double _barFraction(int i) {
    final t = _t;
    if (!widget.isPlaying) {
      return (0.12 + math.sin(t * 1.3 + i * 0.45) * 0.05).clamp(0.06, 1.0);
    }
    final frac = i / _barCount;
    final beat = 0.5 + 0.5 * math.sin(t * 5.6);
    final beat2 = 0.5 + 0.5 * math.sin(t * 2.3 + 1.1);
    final env = math.pow(1 - frac, 0.85).toDouble();
    final wob = 0.55 +
        0.3 * math.sin(t * 9 + i * 0.7) +
        0.2 * math.sin(t * 3.3 + i * 1.9);
    final v = env * (0.3 + 0.7 * (0.6 * beat + 0.4 * beat2)) * wob;
    return v.clamp(0.08, 1.0);
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
        SizedBox(
          height: _maxHeight,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(_barCount, (i) {
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 1),
                  child: Container(
                    height: _maxHeight * _barFraction(i),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      gradient: const LinearGradient(
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
        ),
      ],
    );
  }
}
