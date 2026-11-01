import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/services/app_tutorial_service.dart';

/// Short first-run tips. The long tour stays available from Settings.
class CoachTips {
  static const _key = 'coach_tips_home_v1';

  static Future<void> showOnce(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_key) == true) return;
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('A quick look around'),
        content: const Text(
          'Radio is the live station. Discover is where you meet artists. '
          'Search is in the home bar. Star a song to keep it, and swipe the '
          'artwork to change station.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
    await prefs.setBool(_key, true);
    await AppTutorialService.instance.markCompleted();
  }
}
