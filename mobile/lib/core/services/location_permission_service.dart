import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Asks for GPS permission once after login so Nearby People can use location.
class LocationPermissionService {
  LocationPermissionService._();
  static final LocationPermissionService instance =
      LocationPermissionService._();

  static const _firstLaunchPromptKey = 'location_permission_launch_prompted';
  bool _promptInFlight = false;

  /// One-time explain + system dialog after the user lands on Home.
  Future<void> promptOnLaunch(BuildContext context) async {
    if (_promptInFlight || !context.mounted) return;
    _promptInFlight = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final alreadyPrompted = prefs.getBool(_firstLaunchPromptKey) ?? false;

      final servicesOn = await Geolocator.isLocationServiceEnabled();
      var permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        await prefs.setBool(_firstLaunchPromptKey, true);
        return;
      }

      // Already asked once and permanently denied — don't spam.
      if (alreadyPrompted &&
          permission == LocationPermission.deniedForever) {
        return;
      }

      // Already asked and still denied — skip unless we never prompted in-app.
      if (alreadyPrompted && permission == LocationPermission.denied) {
        return;
      }

      if (!context.mounted) return;

      final wantsLocation = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) {
              return AlertDialog(
                title: const Text('Find people near you'),
                content: Text(
                  servicesOn
                      ? 'Allow location so Nearby People can show who’s around '
                          'you and place you on the local map.'
                      : 'Turn on Location Services, then allow access so Nearby '
                          'People can show who’s around you.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Not now'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Allow location'),
                  ),
                ],
              );
            },
          ) ??
          false;

      await prefs.setBool(_firstLaunchPromptKey, true);

      if (!wantsLocation) return;

      if (!servicesOn) {
        await Geolocator.openLocationSettings();
        return;
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'You can enable location anytime in Settings for Nearby People.',
              ),
            ),
          );
        }
      }
    } catch (_) {
      // Best-effort; Nearby People can still request later.
    } finally {
      _promptInFlight = false;
    }
  }

  /// Current position when permission is already granted; otherwise null.
  Future<Position?> getPositionIfAllowed() async {
    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) return null;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }
      return Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
    } catch (_) {
      return null;
    }
  }
}
