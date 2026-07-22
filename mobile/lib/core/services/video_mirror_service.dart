import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// iOS-only helper: bake a horizontal flip into a recorded selfie clip so the
/// file matches the mirrored front-camera preview.
class VideoMirrorService {
  VideoMirrorService._();

  static const MethodChannel _channel = MethodChannel(
    'com.tmaktechnologies.networxradio/video_mirror',
  );

  /// On iOS, returns a new mirrored file path. Elsewhere (or on failure),
  /// returns [path] unchanged.
  static Future<String> mirrorHorizontallyIfIos(String path) async {
    if (kIsWeb || !Platform.isIOS) return path;
    final input = path.trim();
    if (input.isEmpty) return path;
    try {
      final out = await _channel.invokeMethod<String>(
        'mirrorHorizontally',
        <String, dynamic>{'path': input},
      );
      final mirrored = out?.trim() ?? '';
      if (mirrored.isEmpty) return path;
      if (!File(mirrored).existsSync()) return path;
      if (mirrored != input) {
        try {
          await File(input).delete();
        } catch (_) {}
      }
      return mirrored;
    } catch (e) {
      debugPrint('VideoMirrorService: mirror failed — $e');
      return path;
    }
  }
}
