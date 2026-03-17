import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:radio_app/core/navigation/app_router.dart';
import 'package:radio_app/core/navigation/app_routes.dart';
import 'package:radio_app/core/models/song.dart';

void main() {
  group('AppRouter', () {
    test('builds thread route when required args exist', () {
      final route = AppRouter.onGenerateRoute(
        const RouteSettings(
          name: AppRoutes.thread,
          arguments: <String, dynamic>{
            'myUserId': 'me_123',
            'otherUserId': 'other_456',
            'otherDisplayName': 'Alex',
          },
        ),
      );

      expect(route, isA<MaterialPageRoute<dynamic>>());
    });

    test('builds buy-plays route when song argument exists', () {
      final song = Song(
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
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final route = AppRouter.onGenerateRoute(
        RouteSettings(name: AppRoutes.buyPlays, arguments: song),
      );

      expect(route, isA<MaterialPageRoute<dynamic>>());
    });
  });
}
