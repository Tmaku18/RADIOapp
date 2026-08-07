import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../auth/role_helpers.dart';

/// First-login / replayable app walkthrough state.
class AppTutorialService {
  AppTutorialService._();
  static final AppTutorialService instance = AppTutorialService._();

  /// Bump the suffix when tour copy/steps change so returning users see the
  /// updated walkthrough once (Settings → Help → App tour still replays anytime).
  static const _completedKey = 'app_tutorial_completed_v2';

  /// Bumped from Settings so [HomeScreen] can present the tour.
  final ValueNotifier<int> requestShow = ValueNotifier<int>(0);

  /// Creator roles get the artist tour; everyone else gets the listener tour.
  bool isCreatorRole(String? role) => hasArtistCapability(role);

  Future<bool> hasCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_completedKey) ?? false;
  }

  Future<void> markCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_completedKey, true);
  }

  Future<void> reset() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_completedKey, false);
  }

  /// Ask Home to show the tour (Settings → Help → App tour).
  void requestReplay() {
    requestShow.value = requestShow.value + 1;
  }
}
