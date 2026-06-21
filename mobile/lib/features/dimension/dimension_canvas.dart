import 'package:flutter/material.dart';

import 'butterfly_hero_fallback.dart';
import 'butterfly_hero_scene.dart';

/// Butterfly hero canvas with 3D when available, 2D fallback otherwise.
class DimensionCanvas extends StatefulWidget {
  const DimensionCanvas({super.key});

  @override
  State<DimensionCanvas> createState() => _DimensionCanvasState();
}

class _DimensionCanvasState extends State<DimensionCanvas> {
  bool _useFallback = false;
  bool _sceneReady = false;

  @override
  void initState() {
    super.initState();
    // flutter_angle can take several seconds on first launch; only fall back if
    // setup never completes or explicitly fails.
    Future<void>.delayed(const Duration(seconds: 12), () {
      if (!mounted || _sceneReady || _useFallback) return;
      setState(() => _useFallback = true);
    });
  }

  void _onSceneReady() {
    _sceneReady = true;
  }

  void _onSceneFailed() {
    if (!mounted) return;
    setState(() => _useFallback = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_useFallback) {
      return const ButterflyHeroFallback();
    }

    return ButterflyHeroScene(
      onReady: _onSceneReady,
      onFailed: _onSceneFailed,
    );
  }
}
