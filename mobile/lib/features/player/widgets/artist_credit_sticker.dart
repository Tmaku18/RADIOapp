import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Looks for the song credit, in the same spirit as a sticker pack.
enum ArtistCreditStyle { words, glass, neon, ticket, stamp }

/// Song title and artist credit drawn on a clip.
///
/// The same painter is used for the live preview and the PNG that gets
/// burned into the file, so what you drag is what gets posted.
class ArtistCreditPainter extends CustomPainter {
  ArtistCreditPainter({
    required this.title,
    required this.artist,
    required this.style,
    required this.dx,
    required this.dy,
    required this.scale,
  });

  final String title;
  final String artist;
  final ArtistCreditStyle style;
  final double dx;
  final double dy;
  final double scale;

  static const cyan = Color(0xFF22D3EE);

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width < 8 || size.height < 8) return;
    final song = title.trim().isEmpty ? 'This song' : title.trim();
    final name = artist.trim().isEmpty ? 'Networx Radio' : artist.trim();
    final center = Offset(
      size.width * dx.clamp(0.08, 0.92),
      size.height * dy.clamp(0.08, 0.92),
    );
    final unit = (size.shortestSide * 0.042 * scale).clamp(11.0, 46.0);
    switch (style) {
      case ArtistCreditStyle.words:
        _words(canvas, center, unit, size, song, name);
      case ArtistCreditStyle.glass:
        _card(
          canvas,
          center,
          unit,
          size,
          song,
          name,
          fill: const Color(0xC20A0A0C),
          kicker: 'NETWORX',
          kickerColor: cyan,
          credit: name,
        );
      case ArtistCreditStyle.neon:
        _card(
          canvas,
          center,
          unit,
          size,
          song,
          name,
          fill: const Color(0x8C05070A),
          stroke: cyan,
          kicker: 'NOW PLAYING',
          kickerColor: cyan,
          credit: 'by $name',
          creditColor: cyan,
        );
      case ArtistCreditStyle.ticket:
        _ticket(canvas, center, unit, size, song, name);
      case ArtistCreditStyle.stamp:
        _stamp(canvas, center, unit, size, song, name);
    }
  }

  void _words(
    Canvas canvas,
    Offset center,
    double unit,
    Size size,
    String song,
    String name,
  ) {
    final titlePainter = _text(
      song,
      unit * 1.15,
      FontWeight.w800,
      Colors.white,
      size.width * 0.78,
    );
    final artistPainter = _text(
      name,
      unit * 0.78,
      FontWeight.w600,
      Colors.white70,
      size.width * 0.78,
    );
    final gap = unit * 0.28;
    final block = titlePainter.height + gap + artistPainter.height;
    final top = center.dy - block / 2;
    _shadowed(
      canvas,
      titlePainter,
      Offset(center.dx - titlePainter.width / 2, top),
    );
    _shadowed(
      canvas,
      artistPainter,
      Offset(
        center.dx - artistPainter.width / 2,
        top + titlePainter.height + gap,
      ),
    );
  }

  void _card(
    Canvas canvas,
    Offset center,
    double unit,
    Size size,
    String song,
    String name, {
    required Color fill,
    Color? stroke,
    required String kicker,
    required Color kickerColor,
    required String credit,
    Color creditColor = Colors.white70,
  }) {
    final kickerPainter = _text(
      kicker,
      unit * 0.48,
      FontWeight.w700,
      kickerColor,
      size.width * 0.7,
      letterSpacing: 1.4,
    );
    final titlePainter = _text(
      song,
      unit * 0.95,
      FontWeight.w800,
      Colors.white,
      size.width * 0.7,
    );
    final creditPainter = _text(
      credit,
      unit * 0.68,
      FontWeight.w600,
      creditColor,
      size.width * 0.7,
    );
    final padX = unit * 0.85;
    final padY = unit * 0.55;
    final gap = unit * 0.16;
    final inner = [
      kickerPainter.width,
      titlePainter.width,
      creditPainter.width,
    ].reduce((a, b) => a > b ? a : b);
    final width = inner + padX * 2;
    final height =
        padY * 2 +
        kickerPainter.height +
        titlePainter.height +
        creditPainter.height +
        gap * 2;
    final rect = Rect.fromCenter(center: center, width: width, height: height);
    final radius = Radius.circular(unit * 0.7);
    final rrect = RRect.fromRectAndRadius(rect, radius);
    canvas.drawRRect(rrect, Paint()..color = fill);
    if (stroke != null) {
      canvas.drawRRect(
        rrect,
        Paint()
          ..color = stroke
          ..style = PaintingStyle.stroke
          ..strokeWidth = (unit * 0.08).clamp(1.5, 3.5),
      );
    }
    var y = rect.top + padY;
    kickerPainter.paint(
      canvas,
      Offset(rect.center.dx - kickerPainter.width / 2, y),
    );
    y += kickerPainter.height + gap;
    titlePainter.paint(
      canvas,
      Offset(rect.center.dx - titlePainter.width / 2, y),
    );
    y += titlePainter.height + gap;
    creditPainter.paint(
      canvas,
      Offset(rect.center.dx - creditPainter.width / 2, y),
    );
  }

  void _ticket(
    Canvas canvas,
    Offset center,
    double unit,
    Size size,
    String song,
    String name,
  ) {
    final titlePainter = _text(
      song,
      unit * 0.95,
      FontWeight.w800,
      Colors.white,
      size.width * 0.62,
    );
    final creditPainter = _text(
      '$name · Networx Radio',
      unit * 0.62,
      FontWeight.w600,
      Colors.white70,
      size.width * 0.62,
    );
    final bar = unit * 0.28;
    final padX = unit * 0.7;
    final padY = unit * 0.55;
    final gap = unit * 0.18;
    final inner = titlePainter.width > creditPainter.width
        ? titlePainter.width
        : creditPainter.width;
    final width = bar + padX * 2 + inner;
    final height = padY * 2 + titlePainter.height + creditPainter.height + gap;
    final rect = Rect.fromCenter(center: center, width: width, height: height);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(unit * 0.45));
    canvas.drawRRect(rrect, Paint()..color = const Color(0xE608080C));
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(rect.left, rect.top, bar + unit * 0.2, rect.height),
        Radius.circular(unit * 0.45),
      ),
      Paint()..color = cyan,
    );
    final textLeft = rect.left + bar + padX;
    var y = rect.top + padY;
    titlePainter.paint(canvas, Offset(textLeft, y));
    y += titlePainter.height + gap;
    creditPainter.paint(canvas, Offset(textLeft, y));
  }

  void _stamp(
    Canvas canvas,
    Offset center,
    double unit,
    Size size,
    String song,
    String name,
  ) {
    final kicker = _text(
      'ON AIR',
      unit * 0.46,
      FontWeight.w800,
      Colors.white,
      size.width * 0.5,
      letterSpacing: 2,
    );
    final titlePainter = _text(
      song,
      unit * 0.78,
      FontWeight.w800,
      cyan,
      size.shortestSide * 0.42,
    );
    final artistPainter = _text(
      name,
      unit * 0.55,
      FontWeight.w600,
      Colors.white,
      size.shortestSide * 0.42,
    );
    final widest = [
      kicker.width,
      titlePainter.width,
      artistPainter.width,
    ].reduce((a, b) => a > b ? a : b);
    final radius = (widest / 2 + unit * 0.9).clamp(
      unit * 2.4,
      size.shortestSide * 0.34,
    );
    canvas.drawCircle(center, radius, Paint()..color = const Color(0xB808080C));
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = (unit * 0.09).clamp(1.5, 3),
    );
    canvas.drawCircle(
      center,
      radius - unit * 0.22,
      Paint()
        ..color = cyan.withValues(alpha: 0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = (unit * 0.045).clamp(1, 2),
    );
    final block =
        kicker.height + titlePainter.height + artistPainter.height + unit * 0.2;
    var y = center.dy - block / 2;
    kicker.paint(canvas, Offset(center.dx - kicker.width / 2, y));
    y += kicker.height + unit * 0.08;
    titlePainter.paint(canvas, Offset(center.dx - titlePainter.width / 2, y));
    y += titlePainter.height + unit * 0.06;
    artistPainter.paint(canvas, Offset(center.dx - artistPainter.width / 2, y));
  }

  TextPainter _text(
    String value,
    double size,
    FontWeight weight,
    Color color,
    double maxWidth, {
    double letterSpacing = 0,
  }) {
    final painter = TextPainter(
      text: TextSpan(
        text: value,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: weight,
          letterSpacing: letterSpacing,
          height: 1.05,
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 2,
      ellipsis: '…',
      textAlign: TextAlign.center,
    )..layout(maxWidth: maxWidth);
    return painter;
  }

  void _shadowed(Canvas canvas, TextPainter painter, Offset offset) {
    final shadow = TextPainter(
      text: TextSpan(
        text: (painter.text as TextSpan?)?.text ?? '',
        style: painter.text?.style?.copyWith(color: const Color(0xCC000000)),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 2,
      ellipsis: '…',
      textAlign: TextAlign.center,
    )..layout(maxWidth: painter.width + 4);
    shadow.paint(canvas, offset + const Offset(0, 2));
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(ArtistCreditPainter oldDelegate) {
    return oldDelegate.title != title ||
        oldDelegate.artist != artist ||
        oldDelegate.style != style ||
        oldDelegate.dx != dx ||
        oldDelegate.dy != dy ||
        oldDelegate.scale != scale;
  }

  /// Transparent frame with the credit in the same place as the preview.
  static Future<File> renderPng({
    required String title,
    required String artist,
    required ArtistCreditStyle style,
    required double dx,
    required double dy,
    required double scale,
    required double aspect,
  }) async {
    final safeAspect = aspect.isFinite && aspect > 0.35 && aspect < 2.4
        ? aspect
        : 9 / 16;
    var width = 720.0;
    var height = width / safeAspect;
    if (height > 1280) {
      height = 1280;
      width = height * safeAspect;
    }
    final w = (width / 2).floor() * 2;
    final h = (height / 2).floor() * 2;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    ArtistCreditPainter(
      title: title,
      artist: artist,
      style: style,
      dx: dx,
      dy: dy,
      scale: scale,
    ).paint(canvas, Size(w.toDouble(), h.toDouble()));
    final image = await recorder.endRecording().toImage(w, h);
    try {
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) {
        throw Exception('Could not add the artist credit');
      }
      final file = File(
        '${Directory.systemTemp.path}/networx-credit-${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes.buffer.asUint8List(), flush: true);
      return file;
    } finally {
      image.dispose();
    }
  }
}

class ArtistCreditTray extends StatelessWidget {
  const ArtistCreditTray({
    super.key,
    required this.style,
    required this.scale,
    required this.onStyle,
    required this.onScale,
  });

  final ArtistCreditStyle? style;
  final double scale;
  final ValueChanged<ArtistCreditStyle?> onStyle;
  final ValueChanged<double> onScale;

  static const _styles = <(ArtistCreditStyle, String)>[
    (ArtistCreditStyle.words, 'Words'),
    (ArtistCreditStyle.glass, 'Glass'),
    (ArtistCreditStyle.neon, 'Neon'),
    (ArtistCreditStyle.ticket, 'Ticket'),
    (ArtistCreditStyle.stamp, 'Stamp'),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Artist credit',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'Drag it to move it. It is saved onto the clip when you post or share.',
          style: TextStyle(color: Colors.white70, fontSize: 11),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _chip(
                label: 'Off',
                selected: style == null,
                onTap: () => onStyle(null),
              ),
              for (final option in _styles)
                _chip(
                  label: option.$2,
                  selected: style == option.$1,
                  onTap: () => onStyle(option.$1),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            _chip(
              label: 'Small',
              selected: (scale - 0.8).abs() < 0.05,
              onTap: () => onScale(0.8),
            ),
            _chip(
              label: 'Medium',
              selected: (scale - 1).abs() < 0.05,
              onTap: () => onScale(1),
            ),
            _chip(
              label: 'Large',
              selected: (scale - 1.25).abs() < 0.05,
              onTap: () => onScale(1.25),
            ),
          ],
        ),
      ],
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        visualDensity: VisualDensity.compact,
        labelStyle: TextStyle(
          fontSize: 12,
          color: selected ? Colors.black : Colors.white,
          fontWeight: FontWeight.w600,
        ),
        selectedColor: ArtistCreditPainter.cyan,
        backgroundColor: Colors.white12,
        side: BorderSide(
          color: selected ? ArtistCreditPainter.cyan : Colors.white24,
        ),
      ),
    );
  }
}
