import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

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
      return Transform.scale(scale: 1.14, child: artwork);
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
