import 'package:flutter/material.dart';

import '../services/app_update_service.dart';
import '../services/job_board_service.dart';
import 'app_router.dart';
import 'app_routes.dart';
import 'home_tab_intent.dart';

const _radioTypes = {
  'up_next',
  'live_now',
  'song_up_next',
  'song_up_next_5min',
  'song_live_now',
  'artist_song_on_radio',
  'artist_song_first_play',
  'followed_artist_up_next',
  'followed_artist_up_next_5min',
};

/// True when tapping this notification should leave the inbox.
bool notificationHasTarget(Map<String, dynamic> data) {
  final type = data['type']?.toString() ?? '';
  switch (type) {
    case 'song_played':
    case 'weekly_digest':
    case 'song_approved':
    case 'song_rejected':
    case 'song_status_changed':
    case 'song_liked':
    case 'song_pending_review':
    case 'admin_song_status':
    case 'artist_live_nudge':
    case 'new_message':
    case 'message_request':
    case 'followed_artist_new_upload':
    case 'feed_post_liked':
    case 'content_liked':
    case 'job_application':
    case 'refinery_submission_received':
    case 'refinery_new_review':
    case 'app_update':
      return true;
    case 'artist_live_now':
      return _field(data, const ['artistId', 'artist_id']) != null;
    case 'new_follower':
      return _field(data, const ['followerId', 'follower_id']) != null;
    default:
      return _radioTypes.contains(type);
  }
}

/// Open the screen the notification is about.
Future<void> openNotificationTarget(
  NavigatorState nav,
  Map<String, dynamic> data,
) async {
  if (!notificationHasTarget(data)) return;
  final type = data['type']?.toString() ?? '';

  switch (type) {
    case 'song_played':
      final playId = _field(data, const ['playId', 'play_id']);
      nav.pushNamed(
        AppRoutes.analytics,
        arguments: playId == null ? null : {'playId': playId},
      );
      return;
    case 'weekly_digest':
      nav.pushNamed(AppRoutes.analytics);
      return;
    case 'song_approved':
    case 'song_rejected':
    case 'song_status_changed':
    case 'song_liked':
      nav.pushNamed(AppRoutes.studio);
      return;
    case 'song_pending_review':
    case 'admin_song_status':
      nav.pushNamed(AppRoutes.adminDashboard, arguments: const {'tab': 'songs'});
      return;
    case 'artist_live_nudge':
      nav.pushNamed(AppRoutes.goLive);
      return;
    case 'artist_live_now':
      final artistId = _field(data, const ['artistId', 'artist_id']);
      if (artistId != null) {
        nav.pushNamed(AppRoutes.watchLive, arguments: artistId);
      }
      return;
    case 'new_message':
    case 'message_request':
      final senderId = _field(data, const ['senderId', 'sender_id']);
      if (senderId != null) {
        nav.pushNamed(
          AppRoutes.thread,
          arguments: {
            'myUserId': '',
            'otherUserId': senderId,
            'otherDisplayName': null,
            'isRequest': type == 'message_request',
          },
        );
      } else if (type == 'message_request') {
        nav.pushNamed(AppRoutes.messages, arguments: const {'tab': 'requests'});
      } else {
        nav.pushNamed(AppRoutes.messages);
      }
      return;
    case 'new_follower':
      final followerId = _field(data, const ['followerId', 'follower_id']);
      if (followerId != null) {
        nav.pushNamed(AppRoutes.artistProfile, arguments: followerId);
      }
      return;
    case 'followed_artist_new_upload':
      final artistId = _field(data, const ['artistId', 'artist_id']);
      if (artistId == null) return;
      final songId = _field(data, const ['songId', 'song_id']);
      nav.pushNamed(
        AppRoutes.artistProfile,
        arguments: songId == null
            ? artistId
            : ArtistProfileArgs(artistId: artistId, songId: songId),
      );
      return;
    case 'feed_post_liked':
      _openFeed(nav);
      return;
    case 'content_liked':
      nav.pushNamed(AppRoutes.proMeProfile);
      return;
    case 'job_application':
      final requestId = _field(data, const ['requestId', 'request_id']);
      if (requestId != null) {
        try {
          final request = await JobBoardService().getRequest(requestId);
          if (request != null) {
            nav.push(AppRouter.routeToRequestDetail(request: request));
            return;
          }
        } catch (_) {}
      }
      nav.pushNamed(AppRoutes.jobBoard);
      return;
    case 'refinery_new_review':
      final songId = _field(data, const ['songId', 'song_id']);
      if (songId != null) {
        nav.pushNamed(AppRoutes.refineryAnalytics, arguments: songId);
        return;
      }
      nav.pushNamed(AppRoutes.refinery);
      return;
    case 'refinery_submission_received':
      nav.pushNamed(AppRoutes.refinery);
      return;
    case 'app_update':
      await AppUpdateService.openStoreUrl(
        _field(data, const ['storeUrl', 'store_url']),
      );
      return;
    default:
      if (_radioTypes.contains(type)) {
        nav.pushNamed(AppRoutes.player);
      }
  }
}

void _openFeed(NavigatorState nav) {
  var foundHome = false;
  nav.popUntil((route) {
    if (route.settings.name == AppRoutes.home) foundHome = true;
    return route.settings.name == AppRoutes.home || route.isFirst;
  });
  if (foundHome) {
    HomeTabIntent.openFeed();
    return;
  }
  nav.pushNamed(AppRoutes.home);
  WidgetsBinding.instance.addPostFrameCallback((_) {
    HomeTabIntent.openFeed();
  });
}

String? _field(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value == null) continue;
    final text = value.toString().trim();
    if (text.isEmpty || text == 'null') continue;
    return text;
  }
  return null;
}
