import 'dart:async';

import 'package:flutter/material.dart';

import 'butterfly_hero_fallback.dart';
import 'butterfly_hero_scene.dart';

/// Butterfly hero canvas — 2D placeholder while Three.js warms up, then cross-fades to 3D.
class DimensionCanvas extends StatefulWidget {
  const DimensionCanvas({super.key});

  @override
  State<DimensionCanvas> createState() => _DimensionCanvasState();
}

class _DimensionCanvasState extends State<DimensionCanvas> {
  static const _initTimeout = Duration(seconds: 18);

  bool _useFallbackOnly = false;
  bool _sceneReady = false;
  Timer? _initTimer;

  @override
  void initState() {
    super.initState();
    _initTimer = Timer(_initTimeout, () {
      if (!mounted || _sceneReady || _useFallbackOnly) return;
      debugPrint('DimensionCanvas: 3D init timed out — using 2D fallback');
      _onSceneFailed();
    });
  }

  @override
  void dispose() {
    _initTimer?.cancel();
    super.dispose();
  }

  void _onSceneReady() {
    _initTimer?.cancel();
    if (!mounted) return;
    setState(() => _sceneReady = true);
  }

  void _onSceneFailed() {
    _initTimer?.cancel();
    if (!mounted) return;
    setState(() => _useFallbackOnly = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_useFallbackOnly) {
      return const ButterflyHeroFallback();
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        AnimatedOpacity(
          opacity: _sceneReady ? 0 : 1,
          duration: const Duration(milliseconds: 600),
          child: const ButterflyHeroFallback(),
        ),
        AnimatedOpacity(
          opacity: _sceneReady ? 1 : 0,
          duration: const Duration(milliseconds: 600),
          child: ButterflyHeroScene(
            onReady: _onSceneReady,
            onFailed: _onSceneFailed,
          ),
        ),
      ],
    );
  }
}
