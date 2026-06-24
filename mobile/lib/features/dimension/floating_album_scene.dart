import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/brand/brand_assets.dart';

/// Floating album artwork.
///
/// Previously this rendered a rotating 3D cube via `three_js`, but that path
/// relies on a native GL/ANGLE context that fails to come up on many physical
/// Android devices (it only worked on emulators), so the artwork silently
/// stayed invisible. This is now a plain 2D image with a gentle floating
/// animation, so covers load reliably everywhere.
class FloatingAlbumScene extends StatefulWidget {
  const FloatingAlbumScene({super.key, required this.imageUrl});

  final String imageUrl;

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
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value * math.pi * 2;
        final dy = math.sin(t) * 8.0;
        final tilt = math.sin(t * 0.5) * 0.04;
        return Transform.translate(
          offset: Offset(0, dy),
          child: Transform.rotate(angle: tilt, child: child),
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Image.network(
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
        ),
      ),
    );
  }
}
