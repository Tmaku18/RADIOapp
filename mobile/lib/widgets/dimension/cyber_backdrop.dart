import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import '../../core/theme/dimension_tokens.dart';

/// Web: [CyberBackdrop] — cyber grid + radial fade + bass-reactive orbs.
class CyberBackdrop extends StatefulWidget {
  const CyberBackdrop({super.key, this.bassLevel = 0});

  /// 0..1 bass intensity for orb pulse.
  final double bassLevel;

  @override
  State<CyberBackdrop> createState() => _CyberBackdropState();
}

class _CyberBackdropState extends State<CyberBackdrop> {
  @override
  Widget build(BuildContext context) {
    final i = math.min(1.0, widget.bassLevel * 1.6);
    return IgnorePointer(
      child: Stack(
        fit: StackFit.expand,
        children: [
          CustomPaint(painter: _CyberGridPainter()),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.2,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.4),
                  Colors.black,
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
            ),
          ),
          _BlurOrb(
            top: -160,
            left: -160,
            size: 600,
            color: Colors.cyan.withValues(alpha: 0.1),
            blur: 120,
            opacity: 0.55 + i * 0.45,
            scale: 1 + i * 0.18,
          ),
          _BlurOrb(
            top: MediaQuery.sizeOf(context).height * 0.33,
            right: -160,
            size: 600,
            color: Colors.pink.withValues(alpha: 0.1),
            blur: 140,
            opacity: 0.55 + i * 0.4,
            scale: 1 + i * 0.15,
          ),
          _BlurOrb(
            bottom: 0,
            left: MediaQuery.sizeOf(context).width * 0.33,
            size: 500,
            color: Colors.yellow.withValues(alpha: 0.05),
            blur: 120,
            opacity: 0.4 + i * 0.45,
            scale: 1,
          ),
        ],
      ),
    );
  }
}

class _BlurOrb extends StatelessWidget {
  const _BlurOrb({
    this.top,
    this.left,
    this.right,
    this.bottom,
    required this.size,
    required this.color,
    required this.blur,
    required this.opacity,
    required this.scale,
  });

  final double? top;
  final double? left;
  final double? right;
  final double? bottom;
  final double size;
  final Color color;
  final double blur;
  final double opacity;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: Transform.scale(
        scale: scale,
        child: Opacity(
          opacity: opacity.clamp(0, 1),
          child: ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: blur / 6, sigmaY: blur / 6),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(shape: BoxShape.circle, color: color),
            ),
          ),
        ),
      ),
    );
  }
}

class _CyberGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const gridSize = 56.0;
    final paint = Paint()
      ..color = DimensionTokens.neonCyan.withValues(alpha: 0.06)
      ..strokeWidth = 1;

    for (double x = 0; x < size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
