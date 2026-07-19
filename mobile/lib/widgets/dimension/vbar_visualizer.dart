import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../core/services/audio_visualizer_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../features/player/widgets/frequency_visualizer.dart' show visualizerAudioActive;

/// Smooth 1-D value noise in 0..1 — flowing, organic motion across bars/time.
double _hash(double n) {
  final s = math.sin(n * 127.1) * 43758.5453;
  return s - s.floorToDouble();
}

double _valueNoise(double x) {
  final i = x.floorToDouble();
  final f = x - i;
  final u = f * f * (3 - 2 * f);
  return _hash(i) * (1 - u) + _hash(i + 1) * u;
}

/// Web: `.vbar` equalizer bars. Uses real FFT bars from
/// [AudioVisualizerService] when the Android output tap is running
/// (downsampled to this widget's bar count); otherwise synthesizes music-like
/// motion: an irregular beat envelope drives height while flowing value-noise
/// gives each bar correlated, non-repeating movement (rather than a looping
/// sine).
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
  late final Ticker _ticker;
  double _t = 0;
  Float32List? _realBars;
  bool _active = false;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      setState(() {
        _t = elapsed.inMicroseconds / 1e6;
        _active = widget.isPlaying || visualizerAudioActive();
        _realBars = _active ? AudioVisualizerService().freshBars : null;
      });
    })..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  /// Average the service's 24 real bars down to this widget's bar count.
  double _realBarScale(Float32List real, int i) {
    final n = real.length;
    final s = (i * n) ~/ widget.barCount;
    final e = math.max(s + 1, ((i + 1) * n) ~/ widget.barCount);
    var sum = 0.0;
    for (var j = s; j < e && j < n; j++) {
      sum += real[j];
    }
    return (sum / (e - s)).clamp(0.15, 1.0);
  }

  double _barScale(int i) {
    if (!_active) return 0.2;
    final real = _realBars;
    if (real != null && real.isNotEmpty) {
      return _realBarScale(real, i);
    }
    final t = _t;
    final frac = i / (widget.barCount - 1).clamp(1, 999);

    final b1 = 0.5 + 0.5 * math.sin(t * 5.4);
    final b2 = 0.5 + 0.5 * math.sin(t * 3.13 + 0.7);
    final beat = math.pow(0.62 * b1 + 0.38 * b2, 2.0).toDouble();

    final body = _valueNoise(frac * 4.0 + t * 1.4);
    final shimmer = _valueNoise(frac * 9.0 + t * 4.4);
    final spectral = 0.6 * body + 0.4 * shimmer;

    final tilt = 0.5 + 0.5 * math.pow(1 - frac, 1.0).toDouble();
    final level = (0.2 + 0.8 * beat) * tilt;
    return (level * (0.5 + 0.7 * spectral)).clamp(0.15, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: widget.height,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(widget.barCount, (i) {
          return Container(
            width: 3,
            height: widget.height * _barScale(i),
            margin: const EdgeInsets.symmetric(horizontal: 1.5),
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
          );
        }),
      ),
    );
  }
}
