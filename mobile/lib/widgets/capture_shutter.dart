import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Wordless shutter. A white ring while idle, a red ring that fills while held.
class CaptureShutter extends StatelessWidget {
  const CaptureShutter({
    super.key,
    required this.progress,
    this.recording = false,
    this.locked = false,
  });

  /// How much of the 15 second take is done, from 0 to 1.
  final ValueNotifier<double> progress;
  final bool recording;

  /// Recording hands-free; the centre turns into a stop square.
  final bool locked;

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
              locked: locked,
            ),
          ),
        );
      },
    );
  }
}

/// Snapchat-style shutter: hold to record, slide up or down to zoom, and
/// slide left onto the lock to keep recording without holding.
class HoldShutter extends StatefulWidget {
  const HoldShutter({
    super.key,
    required this.progress,
    required this.recording,
    required this.locked,
    required this.onDown,
    required this.onUp,
    required this.onLock,
    this.onZoomStart,
    this.onZoom,
  });

  final ValueNotifier<double> progress;
  final bool recording;
  final bool locked;
  final VoidCallback onDown;
  final VoidCallback onUp;
  final VoidCallback onLock;
  final VoidCallback? onZoomStart;

  /// Vertical travel since the press began; negative is up.
  final ValueChanged<double>? onZoom;

  @override
  State<HoldShutter> createState() => _HoldShutterState();
}

class _HoldShutterState extends State<HoldShutter> {
  static const double _lockDistance = 72;

  Offset? _start;
  double _lockPull = 0;

  void _down(PointerDownEvent event) {
    _start = event.position;
    _lockPull = 0;
    widget.onDown();
    if (!widget.locked) widget.onZoomStart?.call();
  }

  void _move(PointerMoveEvent event) {
    final start = _start;
    if (start == null || widget.locked) return;
    final delta = event.position - start;
    widget.onZoom?.call(delta.dy);
    if (!widget.recording) return;
    final pull = (-delta.dx / _lockDistance).clamp(0.0, 1.0);
    if (pull >= 1) {
      _start = null;
      setState(() => _lockPull = 0);
      HapticFeedback.mediumImpact();
      widget.onLock();
      return;
    }
    if ((pull - _lockPull).abs() > 0.02) setState(() => _lockPull = pull);
  }

  void _up() {
    _start = null;
    if (_lockPull != 0) setState(() => _lockPull = 0);
    widget.onUp();
  }

  @override
  Widget build(BuildContext context) {
    final showLock = widget.recording && !widget.locked;
    return SizedBox(
      width: 84,
      height: 84,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (showLock)
            Positioned(
              left: -96 + _lockPull * 24,
              top: 18,
              child: IgnorePointer(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Transform.scale(
                      scale: 1 + _lockPull * 0.25,
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Color.lerp(
                            Colors.black45,
                            Colors.white,
                            _lockPull,
                          ),
                        ),
                        child: Icon(
                          Icons.lock_outline_rounded,
                          color: Color.lerp(
                            Colors.white,
                            Colors.black,
                            _lockPull,
                          ),
                        ),
                      ),
                    ),
                    Icon(
                      Icons.chevron_left_rounded,
                      color: Colors.white.withValues(alpha: 0.7),
                    ),
                  ],
                ),
              ),
            ),
          Listener(
            onPointerDown: _down,
            onPointerMove: _move,
            onPointerUp: (_) => _up(),
            onPointerCancel: (_) => _up(),
            child: CaptureShutter(
              progress: widget.progress,
              recording: widget.recording,
              locked: widget.locked,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShutterPainter extends CustomPainter {
  _ShutterPainter({
    required this.progress,
    required this.recording,
    required this.locked,
  });

  final double progress;
  final bool recording;
  final bool locked;

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
    if (recording && locked) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: center, width: 30, height: 30),
          const Radius.circular(6),
        ),
        inner,
      );
      return;
    }
    canvas.drawCircle(center, recording ? 28 : 32, inner);
  }

  @override
  bool shouldRepaint(covariant _ShutterPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.recording != recording ||
        oldDelegate.locked != locked;
  }
}
