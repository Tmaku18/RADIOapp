import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// Explains the camera or microphone request before the system prompt.
Future<bool> confirmMediaAccess(
  BuildContext context, {
  required bool camera,
}) async {
  final allowed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(camera ? 'Camera and microphone' : 'Microphone'),
      content: Text(
        camera
            ? 'NetworX uses your camera and microphone only while you are live. You can turn them off in Settings later.'
            : 'NetworX uses your microphone only while you are on the air. You can turn it off in Settings later.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Not now'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Continue'),
        ),
      ],
    ),
  );
  return allowed == true;
}

Future<void> offerOpenSettings(BuildContext context) async {
  final open = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Permission needed'),
      content: const Text(
        'Camera or microphone access is off. Open Settings to allow it, then come back and try again.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Open Settings'),
        ),
      ],
    ),
  );
  if (open == true) {
    await Geolocator.openAppSettings();
  }
}
