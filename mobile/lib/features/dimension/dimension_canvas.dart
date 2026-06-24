import 'dart:async';

import 'package:flutter/material.dart';

import 'butterfly_hero_fallback.dart';
import 'butterfly_hero_webview.dart';
import 'dimension_scene_utils.dart';

/// Butterfly hero — 2D base always visible; the real web Three.js scene
/// (via WebView) overlays only after it loads and paints, avoiding any blank
/// flash and falling back to the polished 2D hero if the embed can't load.
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
  String _status = 'init';

  @override
  void initState() {
    super.initState();
    _initTimer = Timer(_initTimeout, () {
      if (!mounted || _show3d || _disable3d) return;
      debugPrint('DimensionCanvas: 3D init timed out — keeping 2D hero');
      _setStatus('timeout');
      _onSceneFailed();
    });
  }

  @override
  void dispose() {
    _initTimer?.cancel();
    super.dispose();
  }

  void _setStatus(String status) {
    if (!mounted) return;
    setState(() => _status = status);
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
                child: ButterflyHeroWebView(
                  onReady: _onSceneReady,
                  onFailed: _onSceneFailed,
                  onStatus: _setStatus,
                ),
              ),
            ),
          ),
        if (kDimensionDebugBadge)
          Positioned(
            left: 8,
            top: 8,
            child: IgnorePointer(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '3D:$_status ${_show3d ? "shown" : "hidden"}',
                  style: const TextStyle(color: Color(0xFF00F0FF), fontSize: 10),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
