import 'dart:async';

import 'package:flutter/material.dart';

import 'butterfly_hero_fallback.dart';
import 'butterfly_hero_scene.dart';

/// Butterfly hero — 2D base always visible; 3D overlays only after the first
/// rendered frames (avoids fading 2D away while GL is still a blank surface).
class DimensionCanvas extends StatefulWidget {
  const DimensionCanvas({super.key});

  @override
  State<DimensionCanvas> createState() => _DimensionCanvasState();
}

class _DimensionCanvasState extends State<DimensionCanvas> {
  static const _initTimeout = Duration(seconds: 20);

  bool _show3d = false;
  bool _disable3d = false;
  Timer? _initTimer;

  @override
  void initState() {
    super.initState();
    _initTimer = Timer(_initTimeout, () {
      if (!mounted || _show3d || _disable3d) return;
      debugPrint('DimensionCanvas: 3D init timed out — keeping 2D hero');
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
    if (!mounted || _disable3d) return;
    setState(() => _show3d = true);
  }

  void _onSceneFailed() {
    _initTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _disable3d = true;
      _show3d = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const Positioned.fill(child: ButterflyHeroFallback()),
        if (!_disable3d)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: !_show3d,
              child: AnimatedOpacity(
                opacity: _show3d ? 1 : 0,
                duration: const Duration(milliseconds: 700),
                child: ButterflyHeroScene(
                  onReady: _onSceneReady,
                  onFailed: _onSceneFailed,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
