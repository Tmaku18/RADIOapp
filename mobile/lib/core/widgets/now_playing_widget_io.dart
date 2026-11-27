import 'dart:async';
import 'dart:io';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:home_widget/home_widget.dart';

import '../services/audio_player_service.dart';
import '../services/radio_service.dart';

const _appGroupId = 'group.com.tmaktechnologies.networxradio';
const _liveActivity = MethodChannel('networx/live_activity');

/// Pushes the current song onto the home-screen widget and the iOS lock screen.
class NowPlayingWidgetSync {
  static bool _listening = false;

  /// A pause from the lock screen or island can stay so the listener can
  /// resume. It does not sit there for the rest of the day.
  static const pausedOutsideCardLifetime = Duration(minutes: 30);

  static bool _inForeground = true;
  static bool _dismissWhenLeaving = false;
  static bool _suppressLiveCard = false;
  static bool _needsOutsideArm = false;
  static bool _outsidePauseArmed = false;

  /// Pause inside the app, then leave: the card goes away. Pause from the
  /// lock screen or island: the card stays for [pausedOutsideCardLifetime].
  static void onLifecycle(AppLifecycleState state) {
    if (!Platform.isIOS) return;
    if (state == AppLifecycleState.resumed) {
      _inForeground = true;
      final paused = AudioPlayerService.handler.userPaused;
      if (!paused) {
        _dismissWhenLeaving = false;
        _suppressLiveCard = false;
        _needsOutsideArm = false;
        _outsidePauseArmed = false;
        unawaited(_allowCardUpdates());
        return;
      }
      // They paused in the app, left, and came back. Show the card while
      // they are here. Leaving again removes it.
      if (_dismissWhenLeaving && _suppressLiveCard) {
        _suppressLiveCard = false;
        unawaited(_showCardAgain());
      }
      return;
    }
    final left = state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached;
    if (!left) return;
    _inForeground = false;
    final paused = AudioPlayerService.handler.userPaused;
    if (paused && _dismissWhenLeaving) {
      _needsOutsideArm = false;
      _suppressLiveCard = true;
      unawaited(_endAndHold());
      return;
    }
    if (state == AppLifecycleState.detached && !paused) {
      unawaited(end());
    }
  }

  static Future<void> onUserPausedChanged(bool paused) async {
    if (!Platform.isIOS) {
      await push(AudioPlayerService.handler.mediaItem.valueOrNull);
      return;
    }
    if (!paused) {
      final recreate = _suppressLiveCard || _outsidePauseArmed;
      _dismissWhenLeaving = false;
      _suppressLiveCard = false;
      _needsOutsideArm = false;
      _outsidePauseArmed = false;
      if (recreate) {
        await _replaceCard();
      } else {
        await _allowCardUpdates();
      }
      await push(AudioPlayerService.handler.mediaItem.valueOrNull);
      return;
    }
    if (_inForeground) {
      _dismissWhenLeaving = true;
      _needsOutsideArm = false;
      _outsidePauseArmed = false;
      await push(AudioPlayerService.handler.mediaItem.valueOrNull);
      return;
    }
    _dismissWhenLeaving = false;
    _needsOutsideArm = true;
    await push(AudioPlayerService.handler.mediaItem.valueOrNull);
  }

  /// Lock-screen Mute asks the playing app to silence the station.
  static void listenForLockMute() {
    if (_listening || !Platform.isIOS) return;
    _listening = true;
    _liveActivity.setMethodCallHandler((call) async {
      if (call.method == 'toggleMute') {
        final handler = AudioPlayerService.handler;
        final desired = await _lockMutedFromCard();
        await handler.setUserPaused(
          desired ?? !handler.userPaused,
          fromUser: true,
        );
        return;
      }
      if (call.method == 'react') {
        await react(call.arguments);
      }
    });
    unawaited(drainLockReaction());
  }

  /// The island writes the muted state it just showed. Null if that write
  /// did not land, in which case the app toggles whatever it last knew.
  static Future<bool?> _lockMutedFromCard() async {
    try {
      await HomeWidget.setAppGroupId(_appGroupId);
      final raw = await HomeWidget.getWidgetData<String>('lockMuted');
      if (raw == 'true') return true;
      if (raw == 'false') return false;
    } catch (e) {
      debugPrint('Lock mute read skipped: $e');
    }
    return null;
  }

  /// A lock-screen tap can land before Flutter is listening. Ask iOS to
  /// deliver anything still sitting in the app group.
  static Future<void> drainLockReaction() async {
    if (!Platform.isIOS) return;
    try {
      await _liveActivity.invokeMethod<void>('drain');
    } catch (e) {
      debugPrint('Lock reaction drain skipped: $e');
    }
  }

  static Future<void> end() async {
    if (!Platform.isIOS) return;
    try {
      await _liveActivity.invokeMethod<void>('end');
    } catch (e) {
      debugPrint('Live Activity end skipped: $e');
    }
  }

  /// Dismiss now, and ignore later song updates until playback resumes.
  static Future<void> _endAndHold() async {
    try {
      await _liveActivity.invokeMethod<void>('endHold');
    } catch (e) {
      debugPrint('Live Activity hold skipped: $e');
    }
  }

  static Future<void> _allowCardUpdates() async {
    try {
      await _liveActivity.invokeMethod<void>('allowUpdates');
    } catch (e) {
      debugPrint('Live Activity allow skipped: $e');
    }
  }

  /// Drop a card that was frozen after an outside pause, so a new one can start.
  static Future<void> _replaceCard() async {
    try {
      await _liveActivity.invokeMethod<void>('replaceCard');
    } catch (e) {
      debugPrint('Live Activity replace skipped: $e');
    }
  }

  static Future<void> _showCardAgain() async {
    await _replaceCard();
    await push(AudioPlayerService.handler.mediaItem.valueOrNull);
  }

  static Future<void> _armOutsideDismissal() async {
    _needsOutsideArm = false;
    _outsidePauseArmed = true;
    _suppressLiveCard = true;
    try {
      await _liveActivity.invokeMethod<void>('armDismiss', {
        'seconds': pausedOutsideCardLifetime.inSeconds,
      });
    } catch (e) {
      debugPrint('Live Activity dismiss timer skipped: $e');
    }
  }

  /// Lock-screen 🔥 / 💩. The app stays in the background.
  static Future<void> react(dynamic args) async {
    String? reaction;
    String? songId;
    String? playId;
    if (args is Map) {
      reaction = args['reaction']?.toString();
      songId = args['songId']?.toString();
      playId = args['playId']?.toString();
    } else {
      reaction = args as String?;
    }
    if (reaction != 'fire' && reaction != 'shit') return;
    final vote = reaction as String;
    final item = AudioPlayerService.handler.mediaItem.valueOrNull;
    final fromCard = songId?.trim() ?? '';
    final fromPlayer =
        (item?.extras?['songId'] ?? item?.id)?.toString().trim() ?? '';
    final votedSong = fromCard.isNotEmpty && !fromCard.startsWith('station:')
        ? fromCard
        : fromPlayer;
    if (votedSong.isEmpty || votedSong.startsWith('station:')) return;
    playId ??= item?.extras?['playId']?.toString();
    try {
      await RadioService().submitReaction(
        songId: votedSong,
        playId: playId,
        reaction: vote,
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
      final paused = AudioPlayerService.handler.userPaused;
      // Empty queue, or a pause that already dismissed the card. A later
      // song tick must not put the card back.
      if (item == null || title.isEmpty || (paused && _suppressLiveCard)) {
        if (item == null || title.isEmpty) {
          await _liveActivity.invokeMethod<void>('end');
        }
        return;
      }
      final songId =
          (item.extras?['songId'] ?? item.id).toString().trim();
      final playId = item.extras?['playId']?.toString() ?? '';
      await _liveActivity.invokeMethod<void>('update', {
        'title': shownTitle,
        'artist': shownArtist,
        'station': station.isEmpty ? 'NetworX Radio' : station,
        'artworkUrl': item.artUri?.toString() ?? '',
        'isMuted': paused,
        'songId': songId.startsWith('station:') ? '' : songId,
        'playId': playId,
      });
      if (paused && _needsOutsideArm) {
        await _armOutsideDismissal();
      }
    } catch (e) {
      debugPrint('Live Activity update skipped: $e');
    }
  }
}
