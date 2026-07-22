import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../../core/theme/dimension_tokens.dart';

/// Deep-space swarm of NETWORX brand butterflies — used when a song has no
/// uploaded cover art (full-bleed player background + album placeholder).
class ButterflySwarmBackdrop extends StatefulWidget {
  const ButterflySwarmBackdrop({
    super.key,
    this.butterflyCount = 18,
    this.intensity = 1.0,
  });

  /// How many butterflies drift through the field.
  final int butterflyCount;

  /// Overall brightness of butterflies / stars (0–1). Lower for album tiles.
  final double intensity;

  @override
  State<ButterflySwarmBackdrop> createState() => _ButterflySwarmBackdropState();
}

class _ButterflySwarmBackdropState extends State<ButterflySwarmBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final List<_SwarmButterfly> _butterflies;
  late final List<_Star> _stars;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(42);
    _butterflies = List.generate(
      widget.butterflyCount,
      (i) => _SwarmButterfly.seeded(rng, i),
    );
    _stars = List.generate(90, (i) => _Star.seeded(rng, i));
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
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
        return CustomPaint(
          painter: _ButterflySwarmPainter(
            t: _controller.value,
            butterflies: _butterflies,
            stars: _stars,
            intensity: widget.intensity.clamp(0.0, 1.0),
          ),
          size: Size.infinite,
        );
      },
    );
  }
}

class _SwarmButterfly {
  _SwarmButterfly({
    required this.x0,
    required this.y0,
    required this.scale,
    required this.speed,
    required this.phase,
    required this.driftX,
    required this.driftY,
    required this.alpha,
    required this.rotate,
  });

  factory _SwarmButterfly.seeded(math.Random rng, int i) {
    return _SwarmButterfly(
      x0: rng.nextDouble(),
      y0: rng.nextDouble(),
      scale: 0.35 + rng.nextDouble() * 0.85,
      speed: 0.35 + rng.nextDouble() * 0.9,
      phase: rng.nextDouble() * math.pi * 2,
      driftX: (rng.nextDouble() - 0.5) * 0.35,
      driftY: (rng.nextDouble() - 0.5) * 0.25,
      alpha: 0.28 + rng.nextDouble() * 0.55,
      rotate: (rng.nextDouble() - 0.5) * 0.55,
    );
  }

  final double x0;
  final double y0;
  final double scale;
  final double speed;
  final double phase;
  final double driftX;
  final double driftY;
  final double alpha;
  final double rotate;
}

class _Star {
  _Star({
    required this.x,
    required this.y,
    required this.r,
    required this.phase,
    required this.twinkle,
  });

  factory _Star.seeded(math.Random rng, int i) {
    return _Star(
      x: rng.nextDouble(),
      y: rng.nextDouble(),
      r: 0.4 + rng.nextDouble() * 1.4,
      phase: rng.nextDouble() * math.pi * 2,
      twinkle: 0.4 + rng.nextDouble() * 0.6,
    );
  }

  final double x;
  final double y;
  final double r;
  final double phase;
  final double twinkle;
}

class _ButterflySwarmPainter extends CustomPainter {
  _ButterflySwarmPainter({
    required this.t,
    required this.butterflies,
    required this.stars,
    required this.intensity,
  });

  final double t;
  final List<_SwarmButterfly> butterflies;
  final List<_Star> stars;
  final double intensity;

  static Color get _cyan => DimensionTokens.neonCyan;
  static const _spaceTop = Color(0xFF02040A);
  static const _spaceMid = Color(0xFF050B18);
  static const _spaceBottom = Color(0xFF0A1228);

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;

    // Deep space base.
    final bg = Paint()
      ..shader = ui.Gradient.linear(
        Offset(size.width * 0.2, 0),
        Offset(size.width * 0.8, size.height),
        const [_spaceTop, _spaceMid, _spaceBottom],
        const [0.0, 0.55, 1.0],
      );
    canvas.drawRect(rect, bg);

    // Soft nebula glows.
    final nebulaA = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.25, size.height * 0.3),
        size.shortestSide * 0.55,
        [
          _cyan.withValues(alpha: 0.10 * intensity),
          Colors.transparent,
        ],
      );
    canvas.drawRect(rect, nebulaA);

    final nebulaB = Paint()
      ..shader = ui.Gradient.radial(
        Offset(size.width * 0.78, size.height * 0.72),
        size.shortestSide * 0.48,
        [
          const Color(0xFF7C3AED).withValues(alpha: 0.08 * intensity),
          Colors.transparent,
        ],
      );
    canvas.drawRect(rect, nebulaB);

    // Stars.
    for (final star in stars) {
      final twinkle =
          0.35 +
          0.65 *
              (0.5 +
                  0.5 *
                      math.sin(t * math.pi * 2 * star.twinkle + star.phase));
      final paint = Paint()
        ..color = Colors.white.withValues(alpha: 0.55 * twinkle * intensity);
      canvas.drawCircle(
        Offset(star.x * size.width, star.y * size.height),
        star.r,
        paint,
      );
    }

    // Butterflies — far ones first (smaller / dimmer already baked in scale).
    final sorted = [...butterflies]
      ..sort((a, b) => a.scale.compareTo(b.scale));
    for (final b in sorted) {
      final angle = t * math.pi * 2 * b.speed + b.phase;
      final x = (b.x0 + math.sin(angle) * b.driftX + t * b.driftX * 0.4) % 1.0;
      final y = (b.y0 + math.cos(angle * 0.85) * b.driftY + t * 0.08) % 1.0;
      final nx = x < 0 ? x + 1 : x;
      final ny = y < 0 ? y + 1 : y;
      final flap = 0.72 + 0.28 * math.sin(angle * 3.4);
      final breathe = 0.92 + 0.08 * math.sin(angle * 1.6);

      canvas.save();
      canvas.translate(nx * size.width, ny * size.height);
      canvas.rotate(b.rotate + math.sin(angle) * 0.12);
      final unit = size.shortestSide * 0.085 * b.scale * breathe;
      canvas.scale(unit / 60);
      _paintBrandButterfly(
        canvas,
        flap: flap,
        alpha: b.alpha * intensity,
      );
      canvas.restore();
    }
  }

  /// NETWORX radio butterfly mark (wing swooshes + EQ bars + body).
  void _paintBrandButterfly(
    Canvas canvas, {
    required double flap,
    required double alpha,
  }) {
    final stroke = Paint()
      ..color = _cyan.withValues(alpha: alpha)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fill = Paint()
      ..color = _cyan.withValues(alpha: alpha * 0.95)
      ..style = PaintingStyle.fill;

    final glow = Paint()
      ..color = _cyan.withValues(alpha: alpha * 0.18)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);

    // Soft glow behind mark.
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(0, 2), width: 88, height: 70),
      glow,
    );

    // Wing outline swooshes (flap scales horizontal reach).
    final wingReach = 48.0 * flap;
    final paths = <Path>[
      Path()
        ..moveTo(0, -2)
        ..cubicTo(-15, -17, -34, -19, -wingReach, -9),
      Path()
        ..moveTo(0, -2)
        ..cubicTo(15, -17, 34, -19, wingReach, -9),
      Path()
        ..moveTo(0, 4)
        ..cubicTo(-14, 16, -30, 22, -wingReach * 0.85, 16),
      Path()
        ..moveTo(0, 4)
        ..cubicTo(14, 16, 30, 22, wingReach * 0.85, 16),
    ];
    for (final p in paths) {
      canvas.drawPath(p, stroke);
    }

    // Antennae.
    canvas.drawPath(
      Path()
        ..moveTo(-3, -26)
        ..cubicTo(-7, -34, -11, -38, -16, -41),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(3, -26)
        ..cubicTo(7, -34, 11, -38, 16, -41),
      stroke,
    );

    // Equalizer bars in wings (brand mark).
    void bar(double x, double y, double h) {
      final r = RRect.fromRectAndRadius(
        Rect.fromLTWH(x - 1.3, y, 2.6, h),
        const Radius.circular(1.3),
      );
      canvas.drawRRect(r, fill);
    }

    // Upper left / right — taller toward center.
    const upper = <(double, double, double)>[
      (-36, -12, 10),
      (-30, -16, 14),
      (-24, -21, 19),
      (-18, -25, 23),
      (-12, -28, 26),
      (12, -28, 26),
      (18, -25, 23),
      (24, -21, 19),
      (30, -16, 14),
      (36, -12, 10),
    ];
    for (final (x, y, h) in upper) {
      bar(x * flap, y, h);
    }

    // Lower left / right.
    const lower = <(double, double, double)>[
      (-32, 4, 9),
      (-26, 4, 13),
      (-20, 4, 17),
      (-14, 4, 20),
      (14, 4, 20),
      (20, 4, 17),
      (26, 4, 13),
      (32, 4, 9),
    ];
    for (final (x, y, h) in lower) {
      bar(x * flap, y, h);
    }

    // Body.
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: 4.8, height: 28),
      fill,
    );
  }

  @override
  bool shouldRepaint(covariant _ButterflySwarmPainter oldDelegate) =>
      oldDelegate.t != t ||
      oldDelegate.intensity != intensity ||
      oldDelegate.butterflies != butterflies;
}
