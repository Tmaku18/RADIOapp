import 'package:flutter/foundation.dart';

/// Lightweight bridge so deep screens (e.g. Discover create-video) can switch
/// the main [HomeScreen] tab without a tight parent/child coupling.
class HomeTabIntent {
  HomeTabIntent._();

  static const int feed = 2;

  static void Function(int index)? selectTab;

  static void openFeed() => selectTab?.call(feed);
}

/// Bumps whenever the Social feed should reload (after create/delete).
class SocialFeedRefresh {
  SocialFeedRefresh._();

  static final ValueNotifier<int> tick = ValueNotifier<int>(0);

  static void request() => tick.value = tick.value + 1;
}
