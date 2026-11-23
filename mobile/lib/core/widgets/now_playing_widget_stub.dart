import 'package:audio_service/audio_service.dart';

/// Web builds have no home-screen widget.
class NowPlayingWidgetSync {
  static void listenForLockMute() {}

  static Future<void> push(MediaItem? item) async {}

  static Future<void> end() async {}

  static Future<void> drainLockReaction() async {}
}
