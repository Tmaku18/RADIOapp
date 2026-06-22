import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:three_js/three_js.dart' as three;

import 'dimension_scene_utils.dart';

/// Rotating 3D album cube — port of web [FloatingAlbum].
class FloatingAlbumScene extends StatefulWidget {
  const FloatingAlbumScene({super.key, required this.imageUrl});

  final String imageUrl;

  @override
  State<FloatingAlbumScene> createState() => _FloatingAlbumSceneState();
}

class _FloatingAlbumSceneState extends State<FloatingAlbumScene> {
  late three.ThreeJS threeJs;
  bool _ready = false;
  three.Mesh? _albumMesh;

  @override
  void initState() {
    super.initState();
    threeJs = three.ThreeJS(
      settings: dimensionSceneSettings(),
      onSetupComplete: () {
        if (mounted) setState(() => _ready = true);
      },
      setup: _setup,
      loadingWidget: const Center(
        child: SizedBox(
          width: 24,
          height: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }

  @override
  void dispose() {
    if (_ready) {
      try {
        threeJs.dispose();
      } catch (error) {
        debugPrint('FloatingAlbumScene dispose skipped: $error');
      }
    }
    three.loading.clear();
    super.dispose();
  }

  Future<void> _setup() async {
    threeJs.camera = three.PerspectiveCamera(
      40,
      threeJs.width / threeJs.height,
      0.1,
      100,
    );
    threeJs.camera.position.setValues(0, 0, 5);

    threeJs.scene = three.Scene();
    final texture = await three.TextureLoader().fromNetwork(Uri.parse(widget.imageUrl));
    final geometry = three.BoxGeometry(2.2, 2.2, 0.25);
    final material = three.MeshBasicMaterial.fromMap({
      'map': texture,
      'toneMapped': false,
    });
    _albumMesh = three.Mesh(geometry, material);
    threeJs.scene.add(_albumMesh!);

    threeJs.addAnimationEvent((dt) {
      final t = threeJs.clock.getElapsedTime();
      if (_albumMesh != null) {
        _albumMesh!.rotation.y = t * 0.4;
        _albumMesh!.position.y = math.sin(t * 1.6) * 0.12;
        _albumMesh!.rotation.x = math.sin(t * 0.8) * 0.08;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: _ready ? 1 : 0,
      child: threeJs.build(),
    );
  }
}
