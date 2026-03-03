import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Returns the value for [key] from .env, or null if not loaded or missing.
/// Use this instead of dotenv.env[key] so the app does not crash when .env
/// is absent (e.g. first run, emulator without project .env).
String? env(String key) {
  try {
    return dotenv.env[key];
  } catch (_) {
    return null;
  }
}
