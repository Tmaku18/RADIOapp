import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

/// Puts the on-air song inside a photo or video, then hands that file to
/// Instagram, Snapchat, or TikTok.
///
/// Those apps only play audio that is already in the file, and they will not
/// type a caption for us. The caption is copied before the handoff.
class SocialShare {
  SocialShare._();

  static const MethodChannel _channel = MethodChannel('networx/social');
  static const int clipMs = 15000;

  static Future<File> downloadToTemp(String url) async {
    final raw = url.trim();
    if (raw.isEmpty) {
      throw Exception('Could not download the song');
    }
    if (raw.toLowerCase().contains('.m3u8')) {
      throw Exception('This live stream cannot be saved into a clip');
    }
    final uri = Uri.tryParse(raw);
    if (uri == null) throw Exception('Could not download the song');
    if (uri.scheme == 'file') return File(uri.toFilePath());
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw Exception('Could not download the song');
    }
    final response = await http.get(uri).timeout(const Duration(seconds: 45));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Could not download the song');
    }
    final bytes = response.bodyBytes;
    if (bytes.length < 32) throw Exception('Could not download the song');
    final head = String.fromCharCodes(bytes.take(7));
    if (head.startsWith('#EXTM3U')) {
      throw Exception('This live stream cannot be saved into a clip');
    }
    final ext = _extension(uri.path);
    final file = File(
      '${Directory.systemTemp.path}/networx-media-${DateTime.now().millisecondsSinceEpoch}.$ext',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  static Future<String> attachAudio({
    required String videoPath,
    required String audioPath,
    required int startMs,
    required int durationMs,
  }) {
    return _mux('attachAudio', {
      'videoPath': videoPath,
      'audioPath': audioPath,
      'startMs': startMs,
      'durationMs': durationMs,
    });
  }

  static Future<String> burnOverlay({
    required String videoPath,
    required String overlayPath,
  }) {
    return _mux('burnOverlay', {
      'videoPath': videoPath,
      'overlayPath': overlayPath,
    });
  }

  static Future<String> imageWithAudio({
    required String imagePath,
    required String audioPath,
    required int startMs,
    required int durationMs,
  }) {
    return _mux('imageWithAudio', {
      'imagePath': imagePath,
      'audioPath': audioPath,
      'startMs': startMs,
      'durationMs': durationMs,
    });
  }

  static Future<void> shareFile({
    required String path,
    required String target,
  }) async {
    await _channel.invokeMethod<void>('share', {
      'path': path,
      'target': target,
    });
  }

  static Future<String> _mux(String method, Map<String, Object> args) async {
    final out = await _channel.invokeMethod<String>(method, args);
    if (out == null || out.isEmpty) {
      throw Exception('Could not add the song');
    }
    return out;
  }

  static String _extension(String path) {
    final dot = path.lastIndexOf('.');
    if (dot < 0 || dot == path.length - 1) return 'mp3';
    final ext = path.substring(dot + 1).toLowerCase();
    if (ext.length > 5 || !RegExp(r'^[a-z0-9]+$').hasMatch(ext)) return 'mp3';
    return ext;
  }
}
