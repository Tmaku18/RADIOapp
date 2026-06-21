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
    // flutter_angle needs a full app restart after adding the native plugin.
    // Hot reload throws MissingPluginException and leaves a black void.
    Future<void>.delayed(const Duration(seconds: 3), () {
      if (!mounted || _sceneReady) return;
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
