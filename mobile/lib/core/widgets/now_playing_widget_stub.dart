import 'package:audio_service/audio_service.dart';

/// Web builds have no home-screen widget.
class NowPlayingWidgetSync {
  static Future<void> push(MediaItem? item) async {}
}
