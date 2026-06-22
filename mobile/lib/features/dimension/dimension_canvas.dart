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
  bool _useFallbackOnly = false;
  bool _sceneReady = false;

  void _onSceneReady() {
    if (!mounted) return;
    setState(() => _sceneReady = true);
  }

  void _onSceneFailed() {
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
