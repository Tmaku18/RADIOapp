import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/painting.dart';
import 'package:http/http.dart' as http;

/// Story-sized card Instagram will accept. Instagram does not take a song
/// file or a prefilled caption from other apps, so the link is drawn on the
/// image and also copied for paste.
Future<Uint8List> renderInstagramShareCard({
  required String title,
  required String subtitle,
  required String link,
  String? artworkUrl,
}) async {
  const width = 1080.0;
  const height = 1920.0;
  final artwork = await _loadArtwork(artworkUrl);
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawRect(
    const Rect.fromLTWH(0, 0, width, height),
    Paint()..color = const Color(0xFF07070A),
  );
  canvas.drawRect(
    const Rect.fromLTWH(0, 0, width, 18),
    Paint()..color = const Color(0xFF22D3EE),
  );

  if (artwork != null) {
    final rect = const Rect.fromLTWH(140, 280, 800, 800);
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(rect, const Radius.circular(48)));
    paintImage(canvas: canvas, rect: rect, image: artwork, fit: BoxFit.cover);
    canvas.restore();
  } else {
    final rect = const Rect.fromLTWH(140, 280, 800, 800);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(48)),
      Paint()..color = const Color(0xFF14141C),
    );
  }

  _paint(
    canvas,
    'NETWORX RADIO',
    const Offset(80, 1140),
    width: 920,
    fontSize: 36,
    color: const Color(0xFF22D3EE),
    letterSpacing: 6,
  );
  _paint(
    canvas,
    title,
    const Offset(80, 1220),
    width: 920,
    fontSize: 72,
    color: const Color(0xFFF5F5F5),
    maxLines: 3,
  );
  _paint(
    canvas,
    subtitle,
    const Offset(80, 1500),
    width: 920,
    fontSize: 40,
    color: const Color(0xFFB8B8C2),
    maxLines: 2,
  );
  _paint(
    canvas,
    link,
    const Offset(80, 1680),
    width: 920,
    fontSize: 32,
    color: const Color(0xFF8EE7F5),
    maxLines: 3,
  );

  final picture = recorder.endRecording();
  final image = await picture.toImage(width.toInt(), height.toInt());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  image.dispose();
  artwork?.dispose();
  return bytes!.buffer.asUint8List();
}

void _paint(
  Canvas canvas,
  String text,
  Offset offset, {
  required double width,
  required double fontSize,
  required Color color,
  int maxLines = 1,
  double letterSpacing = 0,
}) {
  final painter = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        letterSpacing: letterSpacing,
        height: 1.15,
      ),
    ),
    textDirection: TextDirection.ltr,
    maxLines: maxLines,
    ellipsis: '…',
  )..layout(maxWidth: width);
  painter.paint(canvas, offset);
}

Future<ui.Image?> _loadArtwork(String? url) async {
  final raw = url?.trim() ?? '';
  if (!raw.startsWith('https://') && !raw.startsWith('http://')) return null;
  try {
    final response = await http.get(Uri.parse(raw)).timeout(const Duration(seconds: 8));
    if (response.statusCode != 200 || response.bodyBytes.length < 32) return null;
    if (response.bodyBytes.length > 8 * 1024 * 1024) return null;
    final codec = await ui.instantiateImageCodec(response.bodyBytes);
    final frame = await codec.getNextFrame();
    codec.dispose();
    return frame.image;
  } catch (_) {
    return null;
  }
}

Future<File> writeInstagramShareCard(Uint8List png) async {
  final file = File(
    '${Directory.systemTemp.path}/networx-instagram-${DateTime.now().millisecondsSinceEpoch}.png',
  );
  await file.writeAsBytes(png, flush: true);
  return file;
}
