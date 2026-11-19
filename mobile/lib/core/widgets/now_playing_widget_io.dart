import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:home_widget/home_widget.dart';

import '../services/audio_player_service.dart';
import '../services/radio_service.dart';

const _appGroupId = 'group.com.tmaktechnologies.networxradio';
const _liveActivity = MethodChannel('networx/live_activity');

/// Pushes the current song onto the home-screen widget and the iOS lock screen.
class NowPlayingWidgetSync {
  static bool _listening = false;

  /// Lock-screen Mute asks the playing app to silence the station.
  static void listenForLockMute() {
    if (_listening || !Platform.isIOS) return;
    _listening = true;
    _liveActivity.setMethodCallHandler((call) async {
      if (call.method == 'toggleMute') {
        final handler = AudioPlayerService.handler;
        await handler.setUserPaused(!handler.userPaused);
        return;
      }
      if (call.method == 'react') {
        await react(call.arguments as String?);
      }
    });
  }

  /// Lock-screen 🔥 / 💩. The app stays in the background.
  static Future<void> react(String? reaction) async {
    if (reaction != 'fire' && reaction != 'shit') return;
    final item = AudioPlayerService.handler.mediaItem.valueOrNull;
    final songId = (item?.extras?['songId'] ?? item?.id)?.toString().trim() ?? '';
    if (songId.isEmpty || songId.startsWith('station:')) return;
    final playId = item?.extras?['playId']?.toString();
    try {
      await RadioService().submitReaction(
        songId: songId,
        playId: playId,
        reaction: reaction!,
      );
    } catch (e) {
      debugPrint('Lock screen reaction skipped: $e');
    }
  }

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
        'artworkUrl': item.artUri?.toString() ?? '',
        'isMuted': AudioPlayerService.handler.userPaused,
      });
    } catch (e) {
      debugPrint('Live Activity update skipped: $e');
    }
  }
}
