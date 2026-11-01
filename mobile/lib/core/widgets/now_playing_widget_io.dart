import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:home_widget/home_widget.dart';

const _appGroupId = 'group.com.tmaktechnologies.networxradio';
const _liveActivity = MethodChannel('networx/live_activity');

/// Pushes the current song onto the home-screen widget and the iOS lock screen.
class NowPlayingWidgetSync {
  static Future<void> push(MediaItem? item) async {
    final title = (item?.title ?? '').trim();
    final artist = (item?.artist ?? '').trim();
    final station = (item?.album ?? '').trim();
    final shownTitle = title.isEmpty ? 'NetworX Radio' : title;
    final shownArtist = artist.isEmpty ? 'Tap to listen' : artist;
    try {
      if (Platform.isIOS) {
        await HomeWidget.setAppGroupId(_appGroupId);
      }
      await HomeWidget.saveWidgetData<String>('title', shownTitle);
      await HomeWidget.saveWidgetData<String>('artist', shownArtist);
      await HomeWidget.updateWidget(
        androidName: 'NowPlayingWidget',
        iOSName: 'NowPlayingWidget',
      );
    } catch (e) {
      debugPrint('Home widget update skipped: $e');
    }
    if (!Platform.isIOS) return;
    try {
      if (item == null || title.isEmpty) {
        await _liveActivity.invokeMethod<void>('end');
        return;
      }
      await _liveActivity.invokeMethod<void>('update', {
        'title': shownTitle,
        'artist': shownArtist,
        'station': station.isEmpty ? 'NetworX Radio' : station,
      });
    } catch (e) {
      debugPrint('Live Activity update skipped: $e');
    }
  }
}
