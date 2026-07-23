import 'dart:io';

import 'package:flutter/foundation.dart';

/// True on iOS/Android app builds where digital goods must use store IAP.
bool get isMobileStorePlatform =>
    !kIsWeb && (Platform.isIOS || Platform.isAndroid);

String get mobileStoreLabel {
  if (!kIsWeb && Platform.isIOS) return 'App Store';
  if (!kIsWeb && Platform.isAndroid) return 'Google Play';
  return 'the store';
}
