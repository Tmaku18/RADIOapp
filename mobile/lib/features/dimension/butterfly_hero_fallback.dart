import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/dimension_tokens.dart';

/// 2D particle butterfly hero — fallback for web Three.js scene.
class ButterflyHeroFallback extends StatefulWidget {
  const ButterflyHeroFallback({super.key});

  @override
  State<ButterflyHeroFallback> createState() => _ButterflyHeroFallbackState();
}

class _ButterflyHeroFallbackState extends State<ButterflyHeroFallback>
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
        return CustomPaint(
          painter: _ButterflyPainter(t: _controller.value),
          size: Size.infinite,
        );
      },
    );
  }
}

class _ButterflyPainter extends CustomPainter {
  _ButterflyPainter({required this.t});
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width * 0.5;
    final cy = size.height * 0.5;
    final flap = math.sin(t * math.pi * 2 * 2.2) * 0.35 + 0.65;

    final wingPaint = Paint()
      ..color = DimensionTokens.neonCyan.withValues(alpha: 0.55)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (final sign in [-1.0, 1.0]) {
      final path = Path();
      path.moveTo(cx, cy);
      path.quadraticBezierTo(
        cx + sign * 40,
        cy - 60 * flap,
        cx + sign * 90,
        cy - 20,
      );
      path.quadraticBezierTo(
        cx + sign * 70,
        cy + 40,
        cx + sign * 30,
        cy + 10,
      );
      path.close();
      canvas.drawPath(path, wingPaint);
    }

    final dust = Paint()
      ..color = DimensionTokens.neonCyan.withValues(alpha: 0.35);
    final rand = math.Random(42);
    for (var i = 0; i < 80; i++) {
      final angle = rand.nextDouble() * math.pi * 2 + t * 2;
      final r = 40 + rand.nextDouble() * 100;
      canvas.drawCircle(
        Offset(cx + math.cos(angle) * r, cy + math.sin(angle) * r),
        1.2,
        dust,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ButterflyPainter oldDelegate) =>
      oldDelegate.t != t;
}

/// Rotating album cube fallback for listen hero.
class FloatingAlbumFallback extends StatefulWidget {
  const FloatingAlbumFallback({super.key, this.imageUrl});

  final String? imageUrl;

  @override
  State<FloatingAlbumFallback> createState() => _FloatingAlbumFallbackState();
}

class _FloatingAlbumFallbackState extends State<FloatingAlbumFallback>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
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
      builder: (context, child) {
        final m = Matrix4.identity()
          ..setEntry(3, 2, 0.001)
          ..rotateY(_controller.value * math.pi * 2)
          ..rotateX(0.25);
        return Transform(
          transform: m,
          alignment: Alignment.center,
          child: child,
        );
      },
      child: Container(
        width: 180,
        height: 180,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          boxShadow: DimensionTokens.glowCyan(),
          border: Border.all(
            color: DimensionTokens.neonCyan.withValues(alpha: 0.4),
          ),
          image: widget.imageUrl != null
              ? DecorationImage(
                  image: NetworkImage(widget.imageUrl!),
                  fit: BoxFit.cover,
                )
              : null,
          color: DimensionTokens.bgSurface,
        ),
      ),
    );
  }
}
