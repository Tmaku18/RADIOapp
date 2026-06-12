// One-off helper: builds a padded Android adaptive-icon foreground from the
// full cyan NETWORX lockup so the wordmark isn't clipped by the launcher mask.
//
// The full lockup is scaled to ~62% of the canvas and centered on a transparent
// background. The adaptive_icon_background color (#0A0A0A) fills the rest, which
// matches the logo's own dark backdrop for a seamless look.
//
// Run from the `mobile/` directory:
//   dart run tool/gen_adaptive_foreground.dart
// Then regenerate launcher icons:
//   dart run flutter_launcher_icons
import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  const srcPath = 'assets/images/branding/networx-logo-cyan.png';
  const outPath = 'assets/launcher/launcher_foreground.png';
  const canvasSize = 1024;
  const scale = 0.62; // keep lockup inside the adaptive safe zone

  final src = img.decodePng(File(srcPath).readAsBytesSync());
  if (src == null) {
    stderr.writeln('Could not decode $srcPath');
    exit(1);
  }

  final target = (canvasSize * scale).round();
  final resized = img.copyResize(
    src,
    width: target,
    height: target,
    interpolation: img.Interpolation.cubic,
  );

  final canvas = img.Image(width: canvasSize, height: canvasSize, numChannels: 4);
  img.fill(canvas, color: img.ColorRgba8(0, 0, 0, 0));

  final offset = ((canvasSize - target) / 2).round();
  img.compositeImage(canvas, resized, dstX: offset, dstY: offset);

  File(outPath).writeAsBytesSync(img.encodePng(canvas));
  stdout.writeln('Wrote $outPath (${target}x$target lockup on ${canvasSize}px canvas)');
}
