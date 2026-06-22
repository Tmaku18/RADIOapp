import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Web: [Reveal] — fade + slide + blur when scrolled into view.
class DimensionReveal extends StatefulWidget {
  const DimensionReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.offsetY = 28,
    this.duration = const Duration(milliseconds: 800),
    this.animateImmediately = false,
  });

  final Widget child;
  final Duration delay;
  final double offsetY;
  final Duration duration;
  final bool animateImmediately;

  @override
  State<DimensionReveal> createState() => _DimensionRevealState();
}

class _DimensionRevealState extends State<DimensionReveal> {
  final GlobalKey _key = GlobalKey();
  bool _revealed = false;
  int _visibilityChecks = 0;

  @override
  void initState() {
    super.initState();
    if (widget.animateImmediately) {
      _revealed = true;
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkVisibility());
    _scheduleVisibilityBurst();
  }

  void _scheduleVisibilityBurst() {
    void tick(Duration _) {
      if (!mounted || _revealed) return;
      _checkVisibility();
      _visibilityChecks += 1;
      if (_visibilityChecks < 120) {
        SchedulerBinding.instance.scheduleFrameCallback(tick);
      }
    }

    SchedulerBinding.instance.scheduleFrameCallback(tick);
  }

  bool _isInViewport() {
    final box = _key.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return false;

    final topLeft = box.localToGlobal(Offset.zero);
    final bottom = topLeft.dy + box.size.height;
    final screenHeight = MediaQuery.sizeOf(context).height;
    return bottom > 0 && topLeft.dy < screenHeight * 0.98;
  }

  void _checkVisibility() {
    if (!mounted || _revealed) return;
    if (_isInViewport()) {
      setState(() => _revealed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return widget.child;
    }

    if (!_revealed) {
      return NotificationListener<ScrollNotification>(
        onNotification: (_) {
          _checkVisibility();
          return false;
        },
        child: Opacity(
          key: _key,
          opacity: 0,
          child: widget.child,
        ),
      );
    }

    return KeyedSubtree(
      key: _key,
      child: widget.child
          .animate(delay: widget.delay)
          .fadeIn(
            duration: widget.duration,
            curve: const Cubic(0.22, 1, 0.36, 1),
          )
          .slideY(
            begin: widget.offsetY / 100,
            end: 0,
            duration: widget.duration,
            curve: const Cubic(0.22, 1, 0.36, 1),
          )
          .blur(
            begin: const Offset(10, 10),
            end: Offset.zero,
            duration: widget.duration,
          ),
    );
  }
}
