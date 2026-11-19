import 'dart:async';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

/// Full-screen camera, cropped to the phone instead of stretched.
///
/// A 4:3 frame pulled edge to edge bows faces like a fishbowl. This covers
/// the screen with the real picture, opens a step tighter than the widest
/// lens, and lets a two-finger pinch zoom in the way Snapchat does.
class CameraStage extends StatefulWidget {
  const CameraStage({
    super.key,
    required this.controller,
    this.mirror = false,
  });

  final CameraController controller;
  final bool mirror;

  @override
  State<CameraStage> createState() => _CameraStageState();
}

class _CameraStageState extends State<CameraStage> {
  double _minZoom = 1;
  double _maxZoom = 1;
  double _zoom = 1;
  double _pinchStart = 1;
  double _scaleBaseline = 1;
  bool _pinching = false;
  bool _applying = false;
  double? _queued;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_prepareZoom());
  }

  @override
  void didUpdateWidget(CameraStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      unawaited(_prepareZoom());
    }
  }

  Future<void> _prepareZoom() async {
    final generation = ++_generation;
    final camera = widget.controller;
    try {
      final minZoom = await camera.getMinZoomLevel();
      final maxZoom = await camera.getMaxZoomLevel();
      if (!mounted || generation != _generation) return;
      // Widest setting is the bent one. Open inside it, and let a pinch
      // travel from that wide end all the way in.
      final opening = math.min(maxZoom, math.max(minZoom, minZoom + 0.45));
      await camera.setZoomLevel(opening);
      if (!mounted || generation != _generation) return;
      setState(() {
        _minZoom = minZoom;
        _maxZoom = maxZoom;
        _zoom = opening;
        _pinchStart = opening;
      });
    } catch (_) {}
  }

  void _queueZoom(double zoom) {
    _queued = zoom;
    if (_applying) return;
    _applying = true;
    unawaited(() async {
      while (_queued != null && mounted) {
        final next = _queued!;
        _queued = null;
        try {
          await widget.controller.setZoomLevel(next);
        } catch (_) {}
      }
      _applying = false;
    }());
  }

  @override
  Widget build(BuildContext context) {
    final camera = widget.controller;
    final preview = camera.value.previewSize;
    final wide = preview == null || preview.width >= preview.height;
    final width = preview == null
        ? 9.0
        : (wide ? preview.height : preview.width);
    final height = preview == null
        ? 16.0
        : (wide ? preview.width : preview.height);

    return GestureDetector(
      onScaleStart: (_) {
        _pinching = false;
      },
      onScaleUpdate: (details) {
        if (details.pointerCount < 2) return;
        if (!_pinching) {
          _pinching = true;
          _pinchStart = _zoom;
          _scaleBaseline = details.scale == 0 ? 1 : details.scale;
        }
        final relative = details.scale / _scaleBaseline;
        final next = (_pinchStart * relative).clamp(_minZoom, _maxZoom);
        setState(() => _zoom = next);
        _queueZoom(next);
      },
      onScaleEnd: (_) {
        _pinching = false;
      },
      child: SizedBox.expand(
        child: FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: width,
            height: height,
            child: Transform(
              alignment: Alignment.center,
              transform: Matrix4.diagonal3Values(widget.mirror ? -1 : 1, 1, 1),
              child: CameraPreview(camera),
            ),
          ),
        ),
      ),
    );
  }
}
