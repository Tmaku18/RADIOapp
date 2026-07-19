import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/services/audio_visualizer_service.dart';
import '../../../core/theme/dimension_tokens.dart';

/// Smooth 1-D value noise in 0..1 (hash + smoothstep interpolation). Sampling it
/// across bar position AND time gives a flowing, organic spectrum that rises and
/// falls in correlated waves — unlike independent per-bar sines, which look
/// mechanical and visibly loop.
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

/// FFT-style frequency bars — web FrequencyVisualizer parity.
///
/// When [AudioVisualizerService] delivers real FFT data (Android output tap,
/// needs the RECORD_AUDIO permission) the bars react to the actual music like
/// the web AnalyserNode path. Otherwise this falls back to the original
/// synthesized spectrum: an irregular beat envelope (incommensurate pulses so
/// it never visibly repeats) drives the overall height, while flowing
/// value-noise gives each bar correlated, organic motion. Calm wave when
/// paused. A continuous ticker drives it so it stays alive regardless of
/// parent rebuilds.
class FrequencyVisualizer extends StatefulWidget {
  const FrequencyVisualizer({super.key, required this.isPlaying});

  final bool isPlaying;

  @override
  State<FrequencyVisualizer> createState() => _FrequencyVisualizerState();
}

class _FrequencyVisualizerState extends State<FrequencyVisualizer>
    with SingleTickerProviderStateMixin {
  static const _barCount = AudioVisualizerService.barCount;
  static const _maxHeight = 48.0;

  late final Ticker _ticker;
  double _t = 0;
  Float32List? _realBars;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      setState(() {
        _t = elapsed.inMicroseconds / 1e6;
        _realBars =
            widget.isPlaying ? AudioVisualizerService().freshBars : null;
      });
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
    final real = _realBars;
    if (real != null && i < real.length) {
      return real[i].clamp(0.04, 1.0);
    }
    final frac = i / (_barCount - 1);

    // Irregular beat envelope: incommensurate pulses summed and sharpened so the
    // "kick" lands at uneven intervals instead of an obvious loop.
    final b1 = 0.5 + 0.5 * math.sin(t * 5.4);
    final b2 = 0.5 + 0.5 * math.sin(t * 3.13 + 0.7);
    final beat = math.pow(0.62 * b1 + 0.38 * b2, 2.0).toDouble();

    // Flowing spectrum: slow body + faster shimmer, correlated across neighbors.
    final body = _valueNoise(frac * 4.5 + t * 1.3);
    final shimmer = _valueNoise(frac * 11.0 + t * 4.2);
    final spectral = 0.62 * body + 0.38 * shimmer;

    // Bass-heavy tilt (left taller) with the treble lifted a little.
    final tilt = 0.4 + 0.6 * math.pow(1 - frac, 1.1).toDouble();

    final level = (0.18 + 0.82 * beat) * tilt;
    final v = level * (0.45 + 0.72 * spectral);
    return v.clamp(0.05, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.isPlaying ? 'LIVE FFT' : 'STANDBY',
          style: TextStyle(
            // Full neon only when the bars reflect real audio; simulated
            // playback dims slightly (paused stays muted, as before).
            color: !widget.isPlaying
                ? DimensionTokens.textMuted
                : _realBars != null
                ? DimensionTokens.neonCyan
                : DimensionTokens.neonCyan.withValues(alpha: 0.55),
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
