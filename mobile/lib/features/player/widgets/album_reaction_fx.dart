import 'dart:math' as math;

import 'package:flutter/material.dart';

/// One-shot cover reaction. A new [id] replays the burst.
class AlbumReactionBurst {
  const AlbumReactionBurst({required this.id, required this.kind});

  final int id;

  /// `fire` or `shit`.
  final String kind;
}

/// Super Saiyan aura for fire, tomato throw and splat for poop.
///
/// Painted outside the cover's clip. Pointers pass through so tilt and
/// swipes still hit the album.
class AlbumReactionHost extends StatefulWidget {
  const AlbumReactionHost({
    super.key,
    required this.burst,
    required this.borderRadius,
    required this.child,
  });

  final AlbumReactionBurst? burst;
  final BorderRadius borderRadius;
  final Widget child;

  @override
  State<AlbumReactionHost> createState() => _AlbumReactionHostState();
}

class _AlbumReactionHostState extends State<AlbumReactionHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
  }

  @override
  void didUpdateWidget(covariant AlbumReactionHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.burst?.id != oldWidget.burst?.id) {
      _play();
    }
  }

  void _play() {
    final burst = widget.burst;
    if (burst == null || MediaQuery.disableAnimationsOf(context)) {
      _controller.stop();
      _controller.value = 0;
      return;
    }
    _controller.duration = Duration(
      milliseconds: burst.kind == 'fire' ? 1400 : 1200,
    );
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  double _punch(double t) {
    if (t < 0.16) return 1 + 0.06 * (t / 0.16);
    return 1 + 0.06 * (1 - ((t - 0.16) / 0.84));
  }

  Offset _shake(double t) {
    if (t < 0.42 || t > 0.78) return Offset.zero;
    final u = (t - 0.42) / 0.36;
    final amp = math.sin(u * math.pi) * 5;
    return Offset(math.sin(u * math.pi * 4) * amp, math.cos(u * math.pi * 3) * amp * 0.45);
  }

  double _flash(double t) {
    if (t < 0.1) return 0.9 * (t / 0.1);
    if (t < 0.26) return 0.9 * (1 - (t - 0.1) / 0.16);
    if (t < 0.42) return 0.15 + 0.45 * ((t - 0.26) / 0.16);
    return 0.6 * (1 - (t - 0.42) / 0.58);
  }

  @override
  Widget build(BuildContext context) {
    final burst = widget.burst;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final show = burst != null && !reduce;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = show ? _controller.value : 0.0;
        final fire = show && burst.kind == 'fire';
        final shit = show && burst.kind == 'shit';
        return Stack(
          clipBehavior: Clip.none,
          fit: StackFit.passthrough,
          children: [
            if (fire)
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(
                    painter: _AuraPainter(t: t),
                  ),
                ),
              ),
            Transform.translate(
              offset: shit ? _shake(t) : Offset.zero,
              child: Transform.scale(
                scale: fire ? _punch(t) : 1,
                child: Stack(
                  fit: StackFit.passthrough,
                  children: [
                    child!,
                    Positioned.fill(
                      child: IgnorePointer(
                        child: ClipRRect(
                          borderRadius: widget.borderRadius,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              if (fire)
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: RadialGradient(
                                      colors: [
                                        Color.fromRGBO(255, 255, 236, _flash(t)),
                                        Color.fromRGBO(255, 210, 60, _flash(t) * 0.45),
                                        const Color(0x00000000),
                                      ],
                                      stops: const [0.0, 0.42, 0.72],
                                    ),
                                  ),
                                ),
                              if (shit)
                                CustomPaint(
                                  painter: _SplatPainter(t: t),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (shit)
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(
                    painter: _TomatoPainter(t: t),
                  ),
                ),
              ),
          ],
        );
      },
      child: widget.child,
    );
  }
}

class _AuraPainter extends CustomPainter {
  _AuraPainter({required this.t});

  final double t;

  double get _opacity {
    if (t < 0.14) return t / 0.14;
    if (t > 0.72) return ((1 - t) / 0.28).clamp(0.0, 1.0);
    return 0.72 + 0.28 * math.sin(t * math.pi * 7);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || _opacity <= 0) return;
    final center = size.center(Offset.zero);
    final side = size.shortestSide;
    final pulse = 0.86 + 0.22 * t + 0.05 * math.sin(t * math.pi * 6);
    final opacity = _opacity;

    final glow = Paint()
      ..shader = RadialGradient(
        colors: [
          Color.fromRGBO(255, 244, 190, 0.85 * opacity),
          Color.fromRGBO(255, 170, 0, 0.35 * opacity),
          const Color(0x00FF5A00),
        ],
        stops: const [0.15, 0.48, 0.78],
      ).createShader(Rect.fromCircle(center: center, radius: side * 0.78));
    canvas.drawCircle(center, side * 0.78, glow);

    _spikes(
      canvas,
      center,
      inner: side * 0.46,
      outer: side * (0.62 + 0.16 * pulse),
      count: 18,
      opacity: opacity,
      spin: t * 0.4,
      hot: false,
    );
    _spikes(
      canvas,
      center,
      inner: side * 0.44,
      outer: side * (0.54 + 0.12 * pulse),
      count: 13,
      opacity: opacity,
      spin: -t * 0.55,
      hot: true,
    );
  }

  void _spikes(
    Canvas canvas,
    Offset center, {
    required double inner,
    required double outer,
    required int count,
    required double opacity,
    required double spin,
    required bool hot,
  }) {
    final paint = Paint()
      ..style = PaintingStyle.fill
      ..color = hot
          ? Color.fromRGBO(255, 246, 200, opacity)
          : Color.fromRGBO(255, 140, 0, opacity);
    for (var i = 0; i < count; i++) {
      final angle = (i / count) * math.pi * 2 + spin;
      final wobble = ((i * 37) % 10) / 10;
      final spread = 0.09 + wobble * 0.05;
      final len = outer - wobble * inner * 0.18;
      final tip = angle + (i.isEven ? 0.05 : -0.04);
      final path = Path()
        ..moveTo(
          center.dx + math.cos(angle - spread) * inner,
          center.dy + math.sin(angle - spread) * inner,
        )
        ..lineTo(
          center.dx + math.cos(tip) * len,
          center.dy + math.sin(tip) * len,
        )
        ..lineTo(
          center.dx + math.cos(angle + spread) * inner,
          center.dy + math.sin(angle + spread) * inner,
        )
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _AuraPainter oldDelegate) => oldDelegate.t != t;
}

class _SplatPainter extends CustomPainter {
  _SplatPainter({required this.t});

  final double t;

  static const _blobs = <_Blob>[
    _Blob(0.50, 0.48, 0.24, 0.18, -0.15),
    _Blob(0.40, 0.44, 0.10, 0.07, 0.4),
    _Blob(0.64, 0.42, 0.08, 0.06, -0.5),
    _Blob(0.34, 0.58, 0.055, 0.04, 0.8),
    _Blob(0.68, 0.60, 0.045, 0.035, -0.2),
    _Blob(0.52, 0.32, 0.04, 0.03, 0.3),
  ];

  static const _seeds = <Offset>[
    Offset(0.48, 0.46),
    Offset(0.56, 0.42),
    Offset(0.42, 0.50),
    Offset(0.60, 0.52),
    Offset(0.50, 0.38),
  ];

  double get _amount {
    if (t < 0.5) return 0;
    if (t < 0.62) return (t - 0.5) / 0.12;
    if (t < 0.82) return 1;
    return ((1 - t) / 0.18).clamp(0.0, 1.0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final amount = _amount;
    if (amount <= 0) return;
    final scale = 0.2 + 0.8 * amount;
    for (final blob in _blobs) {
      final center = Offset(size.width * blob.dx, size.height * blob.dy);
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(blob.rot);
      canvas.scale(scale);
      final paint = Paint()
        ..color = Color.fromRGBO(190, 16, 16, 0.94 * amount)
        ..style = PaintingStyle.fill;
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset.zero,
          width: size.width * blob.rx * 2,
          height: size.height * blob.ry * 2,
        ),
        paint,
      );
      canvas.restore();
    }
    final seedPaint = Paint()..color = Color.fromRGBO(246, 226, 122, amount);
    for (final seed in _seeds) {
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset(size.width * seed.dx, size.height * seed.dy),
          width: size.shortestSide * 0.035,
          height: size.shortestSide * 0.022,
        ),
        seedPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SplatPainter oldDelegate) => oldDelegate.t != t;
}

class _TomatoPainter extends CustomPainter {
  _TomatoPainter({required this.t});

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || t >= 0.78) return;
    final flight = (t / 0.5).clamp(0.0, 1.0);
    final eased = Curves.easeIn.transform(flight);
    final start = Offset(size.width * 1.08, size.height * 1.22);
    final control = Offset(size.width * 0.92, size.height * 0.15);
    final end = Offset(size.width * 0.5, size.height * 0.46);
    final pos = _quad(start, control, end, eased);
    final spin = eased * math.pi * 3.2;
    final squash = t < 0.5 ? 1.0 : (1 - (t - 0.5) / 0.28).clamp(0.28, 1.0);
    final stretch = t < 0.5 ? 1.0 : 1 + (t - 0.5) / 0.28 * 0.7;
    final fade = t < 0.08 ? t / 0.08 : (t > 0.62 ? (0.78 - t) / 0.16 : 1.0);
    final radius = size.shortestSide * 0.09;

    canvas.save();
    canvas.translate(pos.dx, pos.dy);
    canvas.rotate(spin);
    canvas.scale(stretch, squash);

    final body = Paint()..color = Color.fromRGBO(214, 32, 32, fade);
    canvas.drawCircle(Offset.zero, radius, body);
    final shine = Paint()..color = Color.fromRGBO(255, 170, 150, 0.85 * fade);
    canvas.drawCircle(Offset(-radius * 0.28, -radius * 0.32), radius * 0.28, shine);
    final stem = Paint()
      ..color = Color.fromRGBO(46, 140, 48, fade)
      ..strokeWidth = radius * 0.18
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawLine(Offset(0, -radius * 0.7), Offset(0, -radius * 1.25), stem);
    final leaf = Paint()..color = Color.fromRGBO(56, 160, 60, fade);
    final leafPath = Path()
      ..moveTo(0, -radius * 0.85)
      ..quadraticBezierTo(radius * 0.7, -radius * 1.15, radius * 0.85, -radius * 0.7)
      ..quadraticBezierTo(radius * 0.35, -radius * 0.75, 0, -radius * 0.85);
    canvas.drawPath(leafPath, leaf);
    canvas.restore();
  }

  Offset _quad(Offset a, Offset b, Offset c, double u) {
    final v = 1 - u;
    return Offset(
      v * v * a.dx + 2 * v * u * b.dx + u * u * c.dx,
      v * v * a.dy + 2 * v * u * b.dy + u * u * c.dy,
    );
  }

  @override
  bool shouldRepaint(covariant _TomatoPainter oldDelegate) => oldDelegate.t != t;
}

class _Blob {
  const _Blob(this.dx, this.dy, this.rx, this.ry, this.rot);

  final double dx;
  final double dy;
  final double rx;
  final double ry;
  final double rot;
}
