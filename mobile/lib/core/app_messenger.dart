import 'package:flutter/material.dart';

/// App-wide messenger so background services can surface a snackbar without a
/// widget context.
///
/// Screens should keep using `ScaffoldMessenger.of(context)`; this exists for
/// things like the radio connection monitor, which reacts to network events
/// rather than user taps and has no context of its own.
final GlobalKey<ScaffoldMessengerState> appMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Show a transient app-level message. Silently no-ops before the app is
/// mounted, which is expected during early startup.
void showAppSnackBar(SnackBar snackBar) {
  final messenger = appMessengerKey.currentState;
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(snackBar);
}
