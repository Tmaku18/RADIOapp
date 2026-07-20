import 'dart:io';

import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api_service.dart';

/// Soft/force update prompts driven by `GET /app/version`.
class AppUpdateService {
  AppUpdateService._();
  static final AppUpdateService instance = AppUpdateService._();

  final ApiService _api = ApiService();
  static const _dismissedKey = 'app_update_dismissed_version';

  static String defaultStoreUrl() {
    if (Platform.isIOS) {
      return 'https://apps.apple.com/app/networx-radio';
    }
    return 'https://play.google.com/store/apps/details?id=com.tmaktechnologies.networxradio';
  }

  /// Compare semver-ish strings (`1.0.15`). Returns negative if a < b.
  static int compareVersions(String a, String b) {
    List<int> parts(String v) => v
        .split(RegExp(r'[^0-9]+'))
        .where((p) => p.isNotEmpty)
        .map((p) => int.tryParse(p) ?? 0)
        .toList();
    final pa = parts(a);
    final pb = parts(b);
    final len = pa.length > pb.length ? pa.length : pb.length;
    for (var i = 0; i < len; i++) {
      final ai = i < pa.length ? pa[i] : 0;
      final bi = i < pb.length ? pb[i] : 0;
      if (ai != bi) return ai.compareTo(bi);
    }
    return 0;
  }

  Future<void> checkAndPrompt(BuildContext context) async {
    try {
      final info = await PackageInfo.fromPlatform();
      final platform = Platform.isIOS ? 'ios' : 'android';
      final res = await _api.get('app/version?platform=$platform');
      if (res is! Map) return;

      final latestVersion = (res['latestVersion'] ?? '').toString().trim();
      if (latestVersion.isEmpty) return;

      final minVersion = (res['minVersion'] ?? '').toString().trim();
      final force = res['forceUpdate'] == true;
      final title = (res['title'] ?? 'Update available').toString();
      final body = (res['body'] ??
              'A new version of NETWORX Radio is ready.')
          .toString();
      final storeUrl = (res['storeUrl'] ?? '').toString().trim().isEmpty
          ? defaultStoreUrl()
          : (res['storeUrl'] as String).trim();

      final current = info.version;
      final behindLatest = compareVersions(current, latestVersion) < 0;
      final belowMin = minVersion.isNotEmpty &&
          compareVersions(current, minVersion) < 0;
      if (!behindLatest && !belowMin) return;

      final mustUpdate = force || belowMin;
      if (!mustUpdate) {
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getString(_dismissedKey) == latestVersion) return;
      }

      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: !mustUpdate,
        builder: (ctx) {
          return AlertDialog(
            title: Text(title),
            content: Text(
              '$body\n\nYou have $current. Latest is $latestVersion.',
            ),
            actions: [
              if (!mustUpdate)
                TextButton(
                  onPressed: () async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.setString(_dismissedKey, latestVersion);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  child: const Text('Later'),
                ),
              FilledButton(
                onPressed: () async {
                  await openStoreUrl(storeUrl);
                  if (!mustUpdate && ctx.mounted) Navigator.pop(ctx);
                },
                child: const Text('Update'),
              ),
            ],
          );
        },
      );
    } catch (e) {
      debugPrint('AppUpdateService: check failed - $e');
    }
  }

  static Future<void> openStoreUrl(String? url) async {
    final target = (url == null || url.trim().isEmpty)
        ? defaultStoreUrl()
        : url.trim();
    final uri = Uri.tryParse(target);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
