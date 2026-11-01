import 'package:flutter/services.dart';

/// Small haptic helpers so taps feel consistent.
class AppHaptics {
  static void selection() => HapticFeedback.selectionClick();
  static void light() => HapticFeedback.lightImpact();
  static void medium() => HapticFeedback.mediumImpact();
}
