import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../core/brand/brand_assets.dart';

/// Floating album artwork.
///
/// Previously this rendered a rotating 3D cube via `three_js`, but that path
/// relies on a native GL/ANGLE context that fails to come up on many physical
/// Android devices (it only worked on emulators), so the artwork silently
/// stayed invisible. This is now a plain 2D image with a gentle floating
/// animation, so covers load reliably everywhere.
///
/// When [fullscreen] is true, the same float/tilt loop is used as a full-bleed
/// background (scaled up so edges never show while it moves).
class FloatingAlbumScene extends StatefulWidget {
  const FloatingAlbumScene({
    super.key,
    required this.imageUrl,
    this.fullscreen = false,
    this.floatAmplitude,
    this.borderRadius,
    this.blurSigma = 0,
    this.tilt,
  });

  final String imageUrl;

  /// Full-bleed background mode — no rounded clip, edge-bleed scale, same motion.
  final bool fullscreen;

  /// Vertical float distance in logical pixels. Defaults to 8 (or 14 fullscreen).
  final double? floatAmplitude;

  /// Override clip radius. Ignored when [fullscreen] is true.
  final BorderRadius? borderRadius;

  /// Optional soft blur (useful for fullscreen backdrop so foreground UI pops).
  final double blurSigma;

  /// Smoothed touch position, each axis in -1..1. Full-bleed backdrops use
  /// this to lean with the cover the finger is on.
  final ValueNotifier<Offset>? tilt;

  @override
  State<FloatingAlbumScene> createState() => _FloatingAlbumSceneState();
}

class _FloatingAlbumSceneState extends State<FloatingAlbumScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _fallback() => Image.asset(
        BrandAssets.logoCyanAsset,
        fit: BoxFit.cover,
      );

  @override
  Widget build(BuildContext context) {
    final amplitude = widget.floatAmplitude ?? 6.0;
    final radius = widget.fullscreen
        ? BorderRadius.zero
        : (widget.borderRadius ?? BorderRadius.circular(16));

    final artwork = ClipRRect(
      borderRadius: radius,
      child: widget.blurSigma > 0
          ? ImageFiltered(
              imageFilter: ImageFilter.blur(
                sigmaX: widget.blurSigma,
                sigmaY: widget.blurSigma,
              ),
              child: _image(),
            )
          : _image(),
    );

    // As a full-bleed backdrop the artwork holds still. Drifting and tilting a
    // blurred image behind the controls put the whole screen in slow motion,
    // which is exactly the sort of thing that gets tiring on a screen people
    // leave open while they listen.
    if (widget.fullscreen) {
      final tilt = widget.tilt;
      final scaled = Transform.scale(scale: 1.14, child: artwork);
      if (tilt == null) return scaled;
      return AnimatedBuilder(
        animation: tilt,
        builder: (context, child) {
          final dx = tilt.value.dx.clamp(-1.0, 1.0);
          final dy = tilt.value.dy.clamp(-1.0, 1.0);
          return Transform(
            alignment: Alignment.center,
            filterQuality: FilterQuality.low,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.0006)
              ..rotateX(-dy * 0.06)
              ..rotateY(dx * 0.06),
            child: child,
          );
        },
        child: scaled,
      );
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value * math.pi * 2;
        return Transform.translate(
          offset: Offset(0, math.sin(t) * amplitude),
          child: child,
        );
      },
      child: artwork,
    );
  }

  Widget _image() {
    return Image.network(
      widget.imageUrl,
      fit: BoxFit.cover,
      width: double.infinity,
      height: double.infinity,
      gaplessPlayback: true,
      loadingBuilder: (context, child, progress) {
        if (progress == null) return child;
        return const Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      },
      errorBuilder: (context, error, stackTrace) => _fallback(),
    );
  }
}

/// Tilts [child] toward the finger and eases back when the touch ends.
///
/// Uses [Listener] so a parent can still take swipes (station change) and
/// the scroll view can still take a vertical drag.
class TouchTilt extends StatefulWidget {
  const TouchTilt({super.key, required this.child, this.share});

  final Widget child;

  /// Receives the smoothed tilt, each axis in -1..1, so a backdrop can match.
  final ValueNotifier<Offset>? share;

  @override
  State<TouchTilt> createState() => _TouchTiltState();
}

class _TouchTiltState extends State<TouchTilt>
    with SingleTickerProviderStateMixin {
  static const _maxRadians = 0.22;

  late final Ticker _ticker;
  double _x = 0;
  double _y = 0;
  double _targetX = 0;
  double _targetY = 0;
  bool _running = false;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
  }

  void _onTick(Duration _) {
    if (!mounted) return;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final follow = reduce ? 1.0 : 0.34;
    final nextX = _x + (_targetX - _x) * follow;
    final nextY = _y + (_targetY - _y) * follow;
    final settled = _targetX == 0 &&
        _targetY == 0 &&
        nextX.abs() < 0.004 &&
        nextY.abs() < 0.004;
    setState(() {
      _x = settled ? 0 : nextX;
      _y = settled ? 0 : nextY;
    });
    widget.share?.value = Offset(_x, _y);
    if (settled) {
      _ticker.stop();
      _running = false;
    }
  }

  void _wake() {
    if (_running) return;
    _running = true;
    _ticker.start();
  }

  void _point(PointerEvent event) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final local = box.globalToLocal(event.position);
    final w = box.size.width;
    final h = box.size.height;
    if (w <= 0 || h <= 0) return;
    _targetX = ((local.dx / w) * 2 - 1).clamp(-1.0, 1.0);
    _targetY = ((local.dy / h) * 2 - 1).clamp(-1.0, 1.0);
    _wake();
  }

  void _release() {
    _targetX = 0;
    _targetY = 0;
    _wake();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: _point,
      onPointerMove: _point,
      onPointerUp: (_) => _release(),
      onPointerCancel: (_) => _release(),
      child: Transform(
        alignment: Alignment.center,
        filterQuality: FilterQuality.low,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.0014)
          ..rotateX(-_y * _maxRadians)
          ..rotateY(_x * _maxRadians),
        child: widget.child,
      ),
    );
  }
}
