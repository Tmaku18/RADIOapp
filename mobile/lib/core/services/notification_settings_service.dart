import 'package:shared_preferences/shared_preferences.dart';
import 'push_notification_service.dart';

/// Service for managing notification preferences.
/// Uses SharedPreferences for local storage.
class NotificationSettingsService {
  static final NotificationSettingsService _instance = NotificationSettingsService._internal();
  factory NotificationSettingsService() => _instance;
  NotificationSettingsService._internal();

  static const String _keyNotificationsEnabled = 'notifications_enabled';
  static const String _keyUpNextAlerts = 'up_next_alerts';
  static const String _keyLiveNowAlerts = 'live_now_alerts';
  static const String _keySongApprovalAlerts = 'song_approval_alerts';
  static const String _keySoundEnabled = 'notification_sound_enabled';
  static const String _keyVibrationEnabled = 'notification_vibration_enabled';

  SharedPreferences? _prefs;

  /// Initialize the service
  Future<void> initialize() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  /// Get the SharedPreferences instance
  Future<SharedPreferences> get _preferences async {
    _prefs ??= await SharedPreferences.getInstance();
    return _prefs!;
  }

  // ============ Notification Toggles ============

  /// Master notification toggle
  Future<bool> get notificationsEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keyNotificationsEnabled) ?? true;
  }

  Future<void> setNotificationsEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keyNotificationsEnabled, value);
    
    // If disabling notifications, also unregister the device token
    if (!value) {
      await PushNotificationService().unregisterToken();
    } else {
      // Re-register if enabling
      await PushNotificationService().requestPermissionLazy();
    }
  }

  /// "Up Next" alerts (T-60s before your song plays)
  Future<bool> get upNextAlertsEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keyUpNextAlerts) ?? true;
  }

  Future<void> setUpNextAlertsEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keyUpNextAlerts, value);
  }

  /// "Live Now" alerts (when your song starts playing)
  Future<bool> get liveNowAlertsEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keyLiveNowAlerts) ?? true;
  }

  Future<void> setLiveNowAlertsEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keyLiveNowAlerts, value);
  }

  /// Song approval/rejection alerts
  Future<bool> get songApprovalAlertsEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keySongApprovalAlerts) ?? true;
  }

  Future<void> setSongApprovalAlertsEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keySongApprovalAlerts, value);
  }

  // ============ Sound & Vibration ============

  /// Notification sound enabled
  Future<bool> get soundEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keySoundEnabled) ?? true;
  }

  Future<void> setSoundEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keySoundEnabled, value);
  }

  /// Notification vibration enabled
  Future<bool> get vibrationEnabled async {
    final prefs = await _preferences;
    return prefs.getBool(_keyVibrationEnabled) ?? true;
  }

  Future<void> setVibrationEnabled(bool value) async {
    final prefs = await _preferences;
    await prefs.setBool(_keyVibrationEnabled, value);
  }

  // ============ Bulk Operations ============

  /// Get all settings as a map
  Future<Map<String, bool>> getAllSettings() async {
    return {
      'notificationsEnabled': await notificationsEnabled,
      'upNextAlerts': await upNextAlertsEnabled,
      'liveNowAlerts': await liveNowAlertsEnabled,
      'songApprovalAlerts': await songApprovalAlertsEnabled,
      'soundEnabled': await soundEnabled,
      'vibrationEnabled': await vibrationEnabled,
    };
  }

  /// Reset all settings to defaults
  Future<void> resetToDefaults() async {
    final prefs = await _preferences;
    await prefs.remove(_keyNotificationsEnabled);
    await prefs.remove(_keyUpNextAlerts);
    await prefs.remove(_keyLiveNowAlerts);
    await prefs.remove(_keySongApprovalAlerts);
    await prefs.remove(_keySoundEnabled);
    await prefs.remove(_keyVibrationEnabled);
  }
}
