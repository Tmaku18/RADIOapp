import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Wordless shutter. A white ring while idle, a red ring that fills while held.
class CaptureShutter extends StatelessWidget {
  const CaptureShutter({
    super.key,
    required this.progress,
    this.recording = false,
  });

  /// How much of the 15 second take is done, from 0 to 1.
  final ValueNotifier<double> progress;
  final bool recording;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: progress,
      builder: (context, value, _) {
        return SizedBox(
          width: 84,
          height: 84,
          child: CustomPaint(
            painter: _ShutterPainter(
              progress: value.clamp(0, 1),
              recording: recording,
            ),
          ),
        );
      },
    );
  }
}

class _ShutterPainter extends CustomPainter {
  _ShutterPainter({required this.progress, required this.recording});

  final double progress;
  final bool recording;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final outer = size.width / 2 - 2;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = Colors.white;
    canvas.drawCircle(center, outer, ring);

    if (recording && progress > 0) {
      final arc = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..color = const Color(0xFFFF2D2D);
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: outer),
        -math.pi / 2,
        math.pi * 2 * progress,
        false,
        arc,
      );
    }

    final inner = Paint()
      ..color = recording ? const Color(0xFFFF2D2D) : Colors.white;
    canvas.drawCircle(center, recording ? 28 : 32, inner);
  }

  @override
  bool shouldRepaint(covariant _ShutterPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.recording != recording;
  }
}
