import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/navigation/app_router.dart';
import 'package:radio_app/core/navigation/app_routes.dart';
import 'package:radio_app/core/models/song.dart';

Song _sampleSong() => Song(
      id: 'song_1',
      artistId: 'artist_1',
      artistName: 'Artist',
      title: 'Track',
      audioUrl: 'https://example.com/audio.mp3',
      status: 'approved',
      creditsRemaining: 0,
      playCount: 0,
      likeCount: 0,
      skipCount: 0,
      createdAt: DateTime(2024, 1, 1),
      updatedAt: DateTime(2024, 1, 1),
    );

/// Every [AppRoutes] constant with the minimal arguments [AppRouter] accepts.
/// Routes registered only on [MaterialApp.routes] (`root`, `welcome`) are
/// expected to return `null` from [AppRouter.onGenerateRoute].
final List<({String name, Object? args, bool expectNull})> _routeCases = [
  (name: AppRoutes.root, args: null, expectNull: true),
  (name: AppRoutes.welcome, args: null, expectNull: true),
  (name: AppRoutes.login, args: null, expectNull: false),
  (name: AppRoutes.home, args: null, expectNull: false),
  (name: AppRoutes.player, args: null, expectNull: false),
  (name: AppRoutes.analytics, args: null, expectNull: false),
  (name: AppRoutes.upload, args: null, expectNull: false),
  (name: AppRoutes.profile, args: null, expectNull: false),
  (name: AppRoutes.payment, args: null, expectNull: false),
  (name: AppRoutes.settings, args: null, expectNull: false),
  (name: AppRoutes.helpLegal, args: null, expectNull: false),
  (name: AppRoutes.notifications, args: null, expectNull: false),
  (name: AppRoutes.credits, args: null, expectNull: false),
  (name: AppRoutes.messages, args: null, expectNull: false),
  (
    name: AppRoutes.thread,
    args: <String, dynamic>{
      'myUserId': 'me_123',
      'otherUserId': 'other_456',
      'otherDisplayName': 'Alex',
    },
    expectNull: false,
  ),
  (name: AppRoutes.streamSettings, args: null, expectNull: false),
  (name: AppRoutes.goLive, args: 'dj', expectNull: false),
  (name: AppRoutes.watchLive, args: 'artist_1', expectNull: false),
  (name: AppRoutes.proDirectory, args: null, expectNull: false),
  (name: AppRoutes.proMeProfile, args: null, expectNull: false),
  (name: AppRoutes.proProfile, args: 'user_1', expectNull: false),
  (name: AppRoutes.proNetworxLanding, args: null, expectNull: false),
  (name: AppRoutes.proNetworxShell, args: 0, expectNull: false),
  (name: AppRoutes.proNetworxExploreDetail, args: 'post_1', expectNull: false),
  (name: AppRoutes.proNetworxServiceDetail, args: 'svc_1', expectNull: false),
  (name: AppRoutes.proNetworxMyServices, args: null, expectNull: false),
  (name: AppRoutes.proRadio, args: null, expectNull: false),
  (name: AppRoutes.savedPosts, args: null, expectNull: false),
  (name: AppRoutes.likedPosts, args: null, expectNull: false),
  (name: AppRoutes.nearbyPeople, args: null, expectNull: false),
  (name: AppRoutes.refinery, args: null, expectNull: false),
  (name: AppRoutes.refineryAnalytics, args: 'song_1', expectNull: false),
  (name: AppRoutes.yield, args: null, expectNull: false),
  (name: AppRoutes.about, args: null, expectNull: false),
  (name: AppRoutes.studio, args: null, expectNull: false),
  (name: AppRoutes.competition, args: null, expectNull: false),
  (name: AppRoutes.room, args: null, expectNull: false),
  (name: AppRoutes.discovery, args: 0, expectNull: false),
  (name: AppRoutes.jobBoard, args: null, expectNull: false),
  (name: AppRoutes.apply, args: null, expectNull: false),
  (name: AppRoutes.artistProfile, args: 'artist_1', expectNull: false),
  (name: AppRoutes.buyPlays, args: null, expectNull: false), // filled in test
  (name: AppRoutes.liveServices, args: null, expectNull: false),
  (name: AppRoutes.liveSessions, args: null, expectNull: false),
  (name: AppRoutes.liveDj, args: null, expectNull: false),
  (name: AppRoutes.livePerformances, args: null, expectNull: false),
  (name: AppRoutes.adminDashboard, args: null, expectNull: false),
  (name: AppRoutes.allocatePlays, args: null, expectNull: false), // filled in test
  (name: AppRoutes.discoverCreateVideo, args: null, expectNull: false),
];

void main() {
  group('AppRouter — all AppRoutes resolve', () {
    test('inventory matches AppRoutes constants', () {
      const allRoutes = <String>[
        AppRoutes.root,
        AppRoutes.welcome,
        AppRoutes.login,
        AppRoutes.home,
        AppRoutes.player,
        AppRoutes.analytics,
        AppRoutes.upload,
        AppRoutes.profile,
        AppRoutes.payment,
        AppRoutes.settings,
        AppRoutes.helpLegal,
        AppRoutes.notifications,
        AppRoutes.credits,
        AppRoutes.messages,
        AppRoutes.thread,
        AppRoutes.streamSettings,
        AppRoutes.goLive,
        AppRoutes.watchLive,
        AppRoutes.proDirectory,
        AppRoutes.proMeProfile,
        AppRoutes.proProfile,
        AppRoutes.proNetworxLanding,
        AppRoutes.proNetworxShell,
        AppRoutes.proNetworxExploreDetail,
        AppRoutes.proNetworxServiceDetail,
        AppRoutes.proNetworxMyServices,
        AppRoutes.proRadio,
        AppRoutes.savedPosts,
        AppRoutes.likedPosts,
        AppRoutes.nearbyPeople,
        AppRoutes.refinery,
        AppRoutes.refineryAnalytics,
        AppRoutes.yield,
        AppRoutes.about,
        AppRoutes.studio,
        AppRoutes.competition,
        AppRoutes.room,
        AppRoutes.discovery,
        AppRoutes.jobBoard,
        AppRoutes.apply,
        AppRoutes.artistProfile,
        AppRoutes.buyPlays,
        AppRoutes.liveServices,
        AppRoutes.liveSessions,
        AppRoutes.liveDj,
        AppRoutes.livePerformances,
        AppRoutes.adminDashboard,
        AppRoutes.allocatePlays,
        AppRoutes.discoverCreateVideo,
      ];

      expect(_routeCases.map((c) => c.name).toSet(), allRoutes.toSet());
      expect(_routeCases.length, allRoutes.length);
    });

    for (final c in _routeCases) {
      test('${c.name} → ${c.expectNull ? "null (MaterialApp.routes)" : "MaterialPageRoute"}',
          () {
        Object? args = c.args;
        if (c.name == AppRoutes.buyPlays || c.name == AppRoutes.allocatePlays) {
          args = _sampleSong();
        }

        final route = AppRouter.onGenerateRoute(
          RouteSettings(name: c.name, arguments: args),
        );

        if (c.expectNull) {
          expect(route, isNull);
        } else {
          expect(route, isA<MaterialPageRoute<dynamic>>());
        }
      });
    }
  });

  group('AppRouter — invalid args → unknown route', () {
    test('thread without map args', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(name: AppRoutes.thread),
      );
      expect(route, isA<MaterialPageRoute<dynamic>>());
    });

    test('watchLive without artistId', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(name: AppRoutes.watchLive),
      );
      expect(route, isA<MaterialPageRoute<dynamic>>());
    });

    test('artistProfile without id', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(name: AppRoutes.artistProfile),
      );
      expect(route, isA<MaterialPageRoute<dynamic>>());
    });

    test('buyPlays without Song', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(name: AppRoutes.buyPlays, arguments: 'not-a-song'),
      );
      expect(route, isA<MaterialPageRoute<dynamic>>());
    });

    test('unknown name returns null', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(name: '/does-not-exist'),
      );
      expect(route, isNull);
    });
  });
}
