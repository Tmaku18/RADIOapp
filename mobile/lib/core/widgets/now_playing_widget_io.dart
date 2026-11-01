import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

/// Pushes the current song onto the Android home-screen widget.
class NowPlayingWidgetSync {
  static Future<void> push(MediaItem? item) async {
    final title = (item?.title ?? '').trim();
    final artist = (item?.artist ?? '').trim();
    try {
      await HomeWidget.saveWidgetData<String>(
        'title',
        title.isEmpty ? 'NetworX Radio' : title,
      );
      await HomeWidget.saveWidgetData<String>(
        'artist',
        artist.isEmpty ? 'Tap to listen' : artist,
      );
      await HomeWidget.updateWidget(androidName: 'NowPlayingWidget');
    } catch (e) {
      debugPrint('Home widget update skipped: $e');
    }
  }
}
