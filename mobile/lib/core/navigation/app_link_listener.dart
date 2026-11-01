import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/api_service.dart';
import '../services/radio_background_sync_service.dart';
import 'app_link.dart';
import 'app_routes.dart';

/// Opens song, artist, station, and referral links inside the app.
class AppLinkListener {
  static bool _started = false;

  static Future<void> attach(GlobalKey<NavigatorState> navigatorKey) async {
    if (_started) return;
    _started = true;
    final links = AppLinks();
    try {
      final initial = await links.getInitialLink();
      if (initial != null) {
        await _open(navigatorKey, initial);
      }
    } catch (_) {}
    links.uriLinkStream.listen((uri) {
      unawaited(_open(navigatorKey, uri));
    });
  }

  static Future<void> _open(GlobalKey<NavigatorState> navigatorKey, Uri uri) async {
    final parsed = ParsedAppLink.tryParse(uri);
    if (parsed == null) return;
    final code = parsed.referralCode;
    if (code != null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(pendingReferralCodeKey, code);
      } catch (_) {}
    }
    final nav = navigatorKey.currentState;
    if (nav == null) return;
    switch (parsed.kind) {
      case AppLinkKind.artist:
        nav.pushNamed(AppRoutes.artistProfile, arguments: parsed.id);
      case AppLinkKind.radio:
        final stationId = parsed.id;
        if (stationId != null && stationId.isNotEmpty) {
          await RadioBackgroundSyncService.instance.tuneFromExternal(stationId);
        }
        nav.pushNamed(AppRoutes.player);
      case AppLinkKind.song:
        await _openSong(nav, parsed.id!);
      case AppLinkKind.referral:
        nav.pushNamed(AppRoutes.login, arguments: const {'signUp': true});
    }
  }

  static Future<void> _openSong(NavigatorState nav, String songId) async {
    try {
      final res = await ApiService().get('songs/$songId');
      if (res is Map) {
        final artistId = (res['artist_id'] ?? res['artistId'])?.toString() ?? '';
        if (artistId.isNotEmpty) {
          nav.pushNamed(
            AppRoutes.artistProfile,
            arguments: ArtistProfileArgs(artistId: artistId, songId: songId),
          );
          return;
        }
      }
    } catch (_) {}
    nav.pushNamed(AppRoutes.player);
  }
}
