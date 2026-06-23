import 'dart:io' show Platform;
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:three_js/three_js.dart' as three;

const dimensionCyan = 0x00F0FF;
const dimensionCyanDeep = 0x22D3EE;
const dimensionArchColor = 0xA6FBFF;
const dimensionBgDark = 0x050505;

const additiveBlending = 2; // three.js AdditiveBlending

const noteChars = ['\u266A', '\u266B', '\u266C', '\u2669'];

double seededRand(int seed) {
  final x = math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - x.floorToDouble();
}

double lerp(double a, double b, double t) => a + (b - a) * t;

/// Basic (unlit) materials compile reliably on ANGLE + physical Android GPUs.
/// MeshStandardMaterial PBR shaders often fail on Play Store release builds.
three.MeshBasicMaterial cyanBarMaterial({double opacity = 0.95}) {
  return three.MeshBasicMaterial.fromMap({
    'color': dimensionCyan,
    'transparent': true,
    'opacity': opacity,
    'toneMapped': false,
  });
}

three.MeshBasicMaterial cyanArchMaterial({double opacity = 0.92}) {
  return three.MeshBasicMaterial.fromMap({
    'color': dimensionArchColor,
    'transparent': true,
    'opacity': opacity,
    'toneMapped': false,
  });
}

three.Settings dimensionSceneSettings() {
  // Physical Android (Play Store release) uses ANGLE. Keep SurfaceProducer on
  // (customRenderer-only path often paints an opaque black surface). Use mediump
  // basic materials — not highp PBR — for shader compatibility.
  final androidDevice = !kIsWeb && Platform.isAndroid;
  return three.Settings(
    alpha: true,
    antialias: false,
    clearAlpha: 0,
    clearColor: dimensionBgDark,
    enableShadowMap: false,
    useSurfaceProducer: true,
    premultipliedAlpha: androidDevice ? false : true,
    precision: androidDevice ? three.Precision.mediump : three.Precision.highp,
    renderOptions: {'format': three.RGBAFormat, 'samples': 0},
  );
}

Future<List<three.Texture?>> loadNoteTextures(three.TextureLoader loader) async {
  final textures = <three.Texture?>[];
  for (final char in noteChars) {
    textures.add(await createNoteTexture(loader, char));
  }
  return textures;
}

Future<three.Texture?> createNoteTexture(
  three.TextureLoader loader,
  String char,
) async {
  const size = 128;
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble()));

  void paintNote(Color color, double blur) {
    final painter = TextPainter(
      text: TextSpan(
        text: char,
        style: TextStyle(
          color: color,
          fontSize: 92,
          fontWeight: FontWeight.bold,
          fontFamily: 'serif',
          shadows: [
            Shadow(color: const Color(0xFF00F0FF), blurRadius: blur),
          ],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(
      canvas,
      Offset((size - painter.width) / 2, (size - painter.height) / 2 + 4),
    );
  }

  paintNote(const Color(0xFF9EF1FF), 24);
  paintNote(const Color(0xFFE0FBFF), 8);

  final picture = recorder.endRecording();
  final image = await picture.toImage(size, size);
  final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
  if (byteData == null) return null;
  return loader.fromBytes(byteData.buffer.asUint8List());
}

three.Points buildPoints({
  required Float32List positions,
  required int color,
  required double size,
  required double opacity,
}) {
  final geometry = three.BufferGeometry();
  geometry.setAttributeFromString(
    'position',
    three.Float32BufferAttribute.fromList(positions, 3, false),
  );
  final material = three.PointsMaterial.fromMap({
    'color': color,
    'size': size,
    'sizeAttenuation': true,
    'transparent': true,
    'opacity': opacity,
    'depthWrite': false,
    'blending': additiveBlending,
    'toneMapped': false,
  });
  return three.Points(geometry, material);
}
