import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Web: `[data-dimension] .marquee` — infinite horizontal scroll (dim-marquee 30s).
class DimensionMarquee extends StatefulWidget {
  const DimensionMarquee({
    super.key,
    required this.children,
    this.duration = const Duration(seconds: 30),
    this.gap = 20,
    this.height,
  });

  final List<Widget> children;
  final Duration duration;
  final double gap;
  final double? height;

  @override
  State<DimensionMarquee> createState() => _DimensionMarqueeState();
}

class _DimensionMarqueeState extends State<DimensionMarquee>
    with SingleTickerProviderStateMixin {
  final GlobalKey _measureKey = GlobalKey();
  AnimationController? _controller;
  double _segmentWidth = 0;
  bool _paused = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
  }

  @override
  void didUpdateWidget(covariant DimensionMarquee oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.duration != widget.duration) {
      _controller?.duration = widget.duration;
    }
    if (oldWidget.children.length != widget.children.length) {
      _segmentWidth = 0;
      SchedulerBinding.instance.addPostFrameCallback((_) => _measure());
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _measure() {
    if (!mounted) return;
    final box = _measureKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;

    final width = box.size.width + widget.gap;
    if (width <= 0 || (width - _segmentWidth).abs() < 0.5) return;

    setState(() => _segmentWidth = width);
    _startIfNeeded();
  }

  void _startIfNeeded() {
    final controller = _controller;
    if (controller == null || _segmentWidth <= 0 || _paused) return;
    if (MediaQuery.disableAnimationsOf(context)) return;
    if (!controller.isAnimating) {
      controller.repeat();
    }
  }

  void _pause() {
    _paused = true;
    _controller?.stop();
  }

  void _resume() {
    _paused = false;
    _startIfNeeded();
  }

  Widget _strip({Key? key, required List<Widget> children}) {
    return Row(
      key: key,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) SizedBox(width: widget.gap),
          children[i],
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    SchedulerBinding.instance.addPostFrameCallback((_) => _measure());

    if (widget.children.isEmpty) {
      return const SizedBox.shrink();
    }

    final disableMotion = MediaQuery.disableAnimationsOf(context);

    if (disableMotion) {
      return SizedBox(
        height: widget.height,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: _strip(children: widget.children),
        ),
      );
    }

    final controller = _controller!;

    Widget content = AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        final offset =
            _segmentWidth > 0 ? -_segmentWidth * controller.value : 0.0;
        return Transform.translate(
          offset: Offset(offset, 0),
          child: child,
        );
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _strip(key: _measureKey, children: widget.children),
          SizedBox(width: widget.gap),
          _strip(children: widget.children),
        ],
      ),
    );

    content = GestureDetector(
      behavior: HitTestBehavior.translucent,
      onPanDown: (_) => _pause(),
      onPanCancel: () => _resume(),
      onPanEnd: (_) => _resume(),
      onLongPressStart: (_) => _pause(),
      onLongPressEnd: (_) => _resume(),
      child: content,
    );

    content = ClipRect(child: content);

    if (widget.height != null) {
      content = SizedBox(height: widget.height, child: content);
    }

    return content;
  }
}
