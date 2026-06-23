import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:three_js/three_js.dart' as three;

import 'dimension_scene_utils.dart';

class _BarDef {
  _BarDef({
    required this.x,
    required this.row,
    required this.baseH,
    required this.phase,
  });

  final double x;
  final int row;
  final double baseH;
  final double phase;
}

class _NoteSeed {
  _NoteSeed({
    required this.texture,
    required this.vx,
    required this.vy,
    required this.vz,
    required this.size,
    required this.spin,
  });

  final three.Texture? texture;
  final double vx;
  final double vy;
  final double vz;
  final double size;
  final double spin;
}

class _MusicNoteDef {
  _MusicNoteDef({
    required this.texture,
    required this.offset,
    required this.speed,
    required this.side,
    required this.amp,
    required this.spawnX,
    required this.size,
  });

  final three.Texture? texture;
  final double offset;
  final double speed;
  final int side;
  final double amp;
  final double spawnX;
  final double size;
}

/// Full Three.js butterfly hero — port of web [ButterflyHeroScene].
class ButterflyHeroScene extends StatefulWidget {
  const ButterflyHeroScene({super.key, this.onReady, this.onFailed});

  final VoidCallback? onReady;
  final VoidCallback? onFailed;

  @override
  State<ButterflyHeroScene> createState() => _ButterflyHeroSceneState();
}

class _ButterflyHeroSceneState extends State<ButterflyHeroScene> {
  late three.ThreeJS threeJs;
  bool _ready = false;

  double _burstTime = -10;
  double _lastBurstHover = -10;

  final List<_BarMesh> _bars = [];
  final List<three.MeshBasicMaterial> _archMaterials = [];
  three.Object3D? _leftHinge;
  three.Object3D? _rightHinge;
  three.Object3D? _root;
  three.MeshBasicMaterial? _bodyMaterial;

  late Float32List _dustPositions;
  late Float32List _dustVelocities;
  three.BufferGeometry? _dustGeometry;

  final List<_AnimatedSprite> _burstSprites = [];
  final List<_NoteSeed> _burstSeeds = [];
  final List<_AnimatedSprite> _musicSprites = [];
  final List<_MusicNoteDef> _musicNotes = [];

  three.Object3D? _starField;

  @override
  void initState() {
    super.initState();
    threeJs = three.ThreeJS(
      settings: dimensionSceneSettings(),
      onSetupComplete: () {
        if (!mounted) return;
        setState(() => _ready = true);
        widget.onReady?.call();
      },
      setup: _setup,
      loadingWidget: const SizedBox.shrink(),
    );
  }

  @override
  void dispose() {
    if (_ready) {
      try {
        threeJs.dispose();
      } catch (error) {
        debugPrint('ButterflyHeroScene dispose skipped: $error');
      }
    }
    three.loading.clear();
    super.dispose();
  }

  void _triggerBurst({required bool fromTap}) {
    final now = DateTime.now().millisecondsSinceEpoch / 1000.0;
    final since = now - _burstTime;
    if (!fromTap) {
      if (since < 1.6) return;
      if (now - _lastBurstHover < 4) return;
      _lastBurstHover = now;
    } else if (since < 0.6) {
      return;
    }
    _burstTime = now;
  }

  List<_BarDef> _buildBars(int side) {
    const cols = 14;
    final bars = <_BarDef>[];
    for (var i = 0; i < cols; i++) {
      final t = i / (cols - 1);
      final x = lerp(0.15, 1.85, t) * side;
      final env = math.sin(t * math.pi);
      bars.add(
        _BarDef(
          x: x,
          row: 1,
          baseH: 0.18 + env * 0.95,
          phase: i * 0.31 + (side > 0 ? 0 : 1.7),
        ),
      );
      bars.add(
        _BarDef(
          x: x,
          row: -1,
          baseH: 0.16 + env * 0.6,
          phase: i * 0.37 + (side > 0 ? 0.8 : 2.4),
        ),
      );
    }
    return bars;
  }

  three.Group _buildWing(int side) {
    final wing = three.Group();
    wing.scale.setValues(side.toDouble(), 1, 1);

    final barGroup = three.Group();
    for (final def in _buildBars(side)) {
      final geometry = three.BoxGeometry(0.08, 1, 0.08);
      final material = cyanBarMaterial();
      final mesh = three.Mesh(geometry, material);
      mesh.position.setValues(def.x.abs(), 0, 0);
      barGroup.add(mesh);
      _bars.add(_BarMesh(mesh: mesh, def: def));
    }
    wing.add(barGroup);

    final topCurve = three.CubicBezierCurve3(
      three.Vector3(0, 0.12, 0),
      three.Vector3(0.6, 1.25, 0),
      three.Vector3(2.0 * 0.9, 0.9, 0),
      three.Vector3(2.0, 0.0, 0),
    );
    final botCurve = three.CubicBezierCurve3(
      three.Vector3(0, -0.12, 0),
      three.Vector3(0.6, -1.25, 0),
      three.Vector3(2.0 * 0.9, -0.9, 0),
      three.Vector3(2.0, 0.0, 0),
    );

    final archGroup = three.Group();
    for (final curve in [topCurve, botCurve]) {
      final geometry = three.TubeGeometry(curve, 24, 0.06, 8, false);
      final material = cyanArchMaterial();
      _archMaterials.add(material);
      archGroup.add(three.Mesh(geometry, material));
    }
    wing.add(archGroup);

    return wing;
  }

  three.Group _buildButterfly() {
    final root = three.Group();
    _root = root;

    final bodyGeometry = three.CapsuleGeometry(
      radius: 0.05,
      length: 1.4,
      capSegments: 8,
      radialSegments: 16,
    );
    _bodyMaterial = cyanArchMaterial(opacity: 1);
    final body = three.Mesh(bodyGeometry, _bodyMaterial);
    root.add(body);

    final headGeometry = three.SphereGeometry(0.07, 16, 16);
    final headMaterial = cyanArchMaterial(opacity: 1);
    final head = three.Mesh(headGeometry, headMaterial);
    head.position.setValues(0, 0.78, 0);
    root.add(head);

    _rightHinge = three.Group();
    _rightHinge!.add(_buildWing(1));
    root.add(_rightHinge!);

    _leftHinge = three.Group();
    _leftHinge!.add(_buildWing(-1));
    root.add(_leftHinge!);

    return root;
  }

  void _buildStarField(three.Object3D parent) {
    const count = 1800;
    final positions = Float32List(count * 3);
    for (var i = 0; i < count; i++) {
      final r1 = seededRand(i * 17 + 1);
      final r2 = seededRand(i * 17 + 2);
      final r3 = seededRand(i * 17 + 3);
      final r = 7 + r1 * 9;
      final theta = r2 * math.pi * 2;
      final phi = math.acos(2 * r3 - 1);
      positions[i * 3] = r * math.sin(phi) * math.cos(theta);
      positions[i * 3 + 1] = r * math.sin(phi) * math.sin(theta);
      positions[i * 3 + 2] = r * math.cos(phi);
    }
    final stars = buildPoints(
      positions: positions,
      color: 0xffffff,
      size: 0.022,
      opacity: 0.7,
    );
    _starField = stars;
    parent.add(stars);
  }

  void _buildParticleDust(three.Group parent) {
    const count = 600;
    _dustPositions = Float32List(count * 3);
    _dustVelocities = Float32List(count * 3);
    for (var i = 0; i < count; i++) {
      _dustPositions[i * 3] = (seededRand(i * 11 + 1) - 0.5) * 4;
      _dustPositions[i * 3 + 1] = (seededRand(i * 11 + 2) - 0.5) * 2.5;
      _dustPositions[i * 3 + 2] = (seededRand(i * 11 + 3) - 0.5) * 2.5;
      _dustVelocities[i * 3] = (seededRand(i * 11 + 4) - 0.5) * 0.002;
      _dustVelocities[i * 3 + 1] = seededRand(i * 11 + 5) * 0.006 + 0.002;
      _dustVelocities[i * 3 + 2] = (seededRand(i * 11 + 6) - 0.5) * 0.002;
    }
    _dustGeometry = three.BufferGeometry();
    _dustGeometry!.setAttributeFromString(
      'position',
      three.Float32BufferAttribute.fromList(_dustPositions, 3, false),
    );
    final material = three.PointsMaterial.fromMap({
      'color': dimensionCyan,
      'size': 0.035,
      'sizeAttenuation': true,
      'transparent': true,
      'opacity': 0.95,
      'depthWrite': false,
      'blending': additiveBlending,
      'toneMapped': false,
    });
    parent.add(three.Points(_dustGeometry, material));
  }

  void _buildMusicNotes(three.Group parent, List<three.Texture?> textures) {
    const count = 14;
    for (var i = 0; i < count; i++) {
      final def = _MusicNoteDef(
        texture: textures[i % textures.length],
        offset: seededRand(i * 13 + 1) * 6,
        speed: 0.45 + seededRand(i * 13 + 2) * 0.4,
        side: seededRand(i * 13 + 3) < 0.5 ? -1 : 1,
        amp: 0.6 + seededRand(i * 13 + 4) * 0.9,
        spawnX: (seededRand(i * 13 + 5) - 0.5) * 1.6,
        size: 0.4 + seededRand(i * 13 + 6) * 0.35,
      );
      _musicNotes.add(def);
      final material = three.SpriteMaterial.fromMap({
        'map': def.texture,
        'transparent': true,
        'depthWrite': false,
        'blending': additiveBlending,
        'toneMapped': false,
      });
      final sprite = three.Sprite(material);
      parent.add(sprite);
      _musicSprites.add(_AnimatedSprite(sprite: sprite, material: material));
    }
  }

  void _buildNoteBurst(three.Group parent, List<three.Texture?> textures) {
    const count = 56;
    for (var i = 0; i < count; i++) {
      final angle = (i / count) * math.pi * 2 + seededRand(i * 7 + 1) * 0.4;
      final speed = 3.2 + seededRand(i * 7 + 2) * 3.0;
      final seed = _NoteSeed(
        texture: textures[i % textures.length],
        vx: math.cos(angle) * speed,
        vy: math.sin(angle) * speed * 0.85 + 0.6,
        vz: (seededRand(i * 7 + 3) - 0.5) * 1.5,
        size: 0.55 + seededRand(i * 7 + 4) * 0.5,
        spin: (seededRand(i * 7 + 5) - 0.5) * 5,
      );
      _burstSeeds.add(seed);
      final material = three.SpriteMaterial.fromMap({
        'map': seed.texture,
        'transparent': true,
        'depthWrite': false,
        'blending': additiveBlending,
        'toneMapped': false,
        'opacity': 0,
      });
      final sprite = three.Sprite(material);
      sprite.visible = false;
      parent.add(sprite);
      _burstSprites.add(_AnimatedSprite(sprite: sprite, material: material));
    }
  }

  Future<void> _setup() async {
    try {
      await _buildScene();
    } catch (error, stackTrace) {
      debugPrint('ButterflyHeroScene setup failed: $error\n$stackTrace');
      widget.onFailed?.call();
    }
  }

  Future<void> _buildScene() async {
    threeJs.camera = three.PerspectiveCamera(
      45,
      threeJs.width / threeJs.height,
      0.1,
      100,
    );
    threeJs.camera.position.setValues(0, 0.2, 6.4);

    threeJs.scene = three.Scene();
    threeJs.scene.fog = three.Fog(dimensionBgDark, 9, 22);

    _buildStarField(threeJs.scene);

    final content = three.Group();
    content.position.setValues(2.4, 0.2, 0);

    _buildParticleDust(content);
    content.add(_buildButterfly());

    List<three.Texture?> noteTextures;
    try {
      noteTextures = await loadNoteTextures(three.TextureLoader());
    } catch (error, stackTrace) {
      debugPrint('ButterflyHeroScene note textures skipped: $error\n$stackTrace');
      noteTextures = List<three.Texture?>.filled(noteChars.length, null);
    }
    _buildMusicNotes(content, noteTextures);
    _buildNoteBurst(content, noteTextures);

    threeJs.scene.add(content);
    threeJs.camera.lookAt(threeJs.scene.position);

    threeJs.addAnimationEvent(_animate);
  }

  void _animate(double dt) {
    final t = threeJs.clock.getElapsedTime();
    final now = DateTime.now().millisecondsSinceEpoch / 1000.0;
    final sinceBurst = now - _burstTime;
    final bp = sinceBurst > 0 && sinceBurst < 1.4
        ? (sinceBurst / 1.4).clamp(0.0, 1.0)
        : 0.0;
    final burstAngle = bp > 0 ? math.sin(bp * math.pi) * 1.35 : 0.0;
    final burstScale = bp > 0 ? 1 + math.sin(bp * math.pi) * 0.14 : 1.0;
    final burstFlash = bp > 0 ? math.sin(bp * math.pi) * 2.4 : 0.0;

    final flap = math.sin(t * 4.4) * 0.6 + 0.2;
    _rightHinge?.rotation.y = -flap - burstAngle;
    _leftHinge?.rotation.y = flap + burstAngle;

    _root?.position.y = math.sin(t * 1.6) * 0.18;
    _root?.rotation.z = math.sin(t * 0.8) * 0.04;
    _root?.scale.setScalar(burstScale);

    if (_bodyMaterial != null) {
      _bodyMaterial!.opacity =
          (0.88 + math.sin(t * 4.4) * 0.08 + burstFlash * 0.05).clamp(0.55, 1.0);
    }

    for (final bar in _bars) {
      final wobble = 0.6 + math.sin(t * 6 + bar.def.phase) * 0.4;
      final h = bar.def.baseH * wobble;
      bar.mesh.scale.y = h;
      bar.mesh.position.y = bar.def.row * (h / 2 + 0.04);
      final mat = bar.mesh.material as three.MeshBasicMaterial?;
      if (mat != null) {
        mat.opacity =
            (0.82 + math.sin(t * 6 + bar.def.phase) * 0.18).clamp(0.45, 1.0);
      }
    }

    for (final mat in _archMaterials) {
      mat.opacity = (0.86 + math.sin(t * 2.2) * 0.12).clamp(0.5, 1.0);
    }

    if (_dustGeometry != null) {
      final attr = _dustGeometry!.getAttributeFromString('position');
      if (attr != null) {
        final pos = attr.array as Float32List;
        const count = 600;
        for (var i = 0; i < count; i++) {
          pos[i * 3] += _dustVelocities[i * 3];
          pos[i * 3 + 1] += _dustVelocities[i * 3 + 1];
          pos[i * 3 + 2] += _dustVelocities[i * 3 + 2];
          if (pos[i * 3 + 1] > 3.5) {
            pos[i * 3] = (math.Random().nextDouble() - 0.5) * 4;
            pos[i * 3 + 1] = -2.5;
            pos[i * 3 + 2] = (math.Random().nextDouble() - 0.5) * 2.5;
          }
        }
        attr.needsUpdate = true;
      }
    }

    for (var i = 0; i < _musicSprites.length; i++) {
      final sprite = _musicSprites[i];
      final def = _musicNotes[i];
      final life = (t * def.speed + def.offset) % 6;
      final p = life / 6;
      sprite.sprite.position.x =
          def.spawnX + def.side * math.sin(life * 1.4) * def.amp;
      sprite.sprite.position.y = -1.2 + p * 4.6;
      sprite.sprite.position.z = math.cos(life * 0.8 + i) * 0.4;
      final fade = math.sin(p * math.pi);
      sprite.material.opacity = fade * 0.95;
      sprite.sprite.scale.setScalar(def.size * (0.6 + fade * 0.6));
      sprite.material.rotation = math.sin(life * 2) * 0.4;
    }

    final burstActive = sinceBurst >= 0 && sinceBurst < 2.2;
    for (var i = 0; i < _burstSprites.length; i++) {
      final sprite = _burstSprites[i];
      final seed = _burstSeeds[i];
      if (!burstActive) {
        sprite.sprite.visible = false;
        continue;
      }
      sprite.sprite.visible = true;
      final tau = sinceBurst;
      sprite.sprite.position.x = seed.vx * tau;
      sprite.sprite.position.y = seed.vy * tau - 0.4 * tau * tau;
      sprite.sprite.position.z = seed.vz * tau;
      final life = (tau / 2.0).clamp(0.0, 1.0);
      final fade = life < 0.1 ? life / 0.1 : 1 - (life - 0.1) / 0.9;
      sprite.material.opacity = fade.clamp(0.0, 1.0);
      sprite.sprite.scale.setScalar(seed.size * (0.6 + fade * 0.7));
      sprite.material.rotation = seed.spin * tau;
    }

    _starField?.rotation.y = t * 0.015;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _triggerBurst(fromTap: true),
      onPanDown: (_) => _triggerBurst(fromTap: false),
      child: ClipRect(
        child: Opacity(
          opacity: _ready ? 1 : 0,
          child: threeJs.build(),
        ),
      ),
    );
  }
}

class _BarMesh {
  _BarMesh({required this.mesh, required this.def});

  final three.Mesh mesh;
  final _BarDef def;
}

class _AnimatedSprite {
  _AnimatedSprite({required this.sprite, required this.material});

  final three.Sprite sprite;
  final three.SpriteMaterial material;
}
