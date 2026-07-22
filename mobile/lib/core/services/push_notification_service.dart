import 'dart:convert';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';
import 'notification_settings_service.dart';

/// Top-level handler required by firebase_messaging for background isolates.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Notification+data messages are presented by the OS on iOS/Android.
  // Keep this registered so background delivery is wired correctly.
  debugPrint(
    'PushNotificationService: background message '
    '${message.messageId ?? message.data['type']}',
  );
}

/// Push notification service with production-grade features:
/// - First-login permission prompt (iOS/Android system dialog)
/// - Token refresh: Listen to onTokenRefresh stream
/// - Foreground notifications: Display using flutter_local_notifications
/// - Deep linking: Navigate to player on notification tap
class PushNotificationService {
  static final PushNotificationService _instance =
      PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  static const _firstLoginPromptKey = 'push_permission_first_login_prompted';

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiService _apiService = ApiService();

  bool _initialized = false;
  bool _firstLoginPromptInFlight = false;
  String? _currentToken;

  // Callback for handling notification taps
  Function(Map<String, dynamic>)? onNotificationTap;

  /// Initialize the push notification service (call after Firebase init)
  Future<void> initialize() async {
    if (_initialized) return;

    // Initialize local notifications for foreground display
    await _initializeLocalNotifications();

    // iOS: allow system banners while the app is in the foreground.
    if (Platform.isIOS) {
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }

    // Set up token refresh listener immediately
    _messaging.onTokenRefresh.listen(_onTokenRefresh).onError((error) {
      debugPrint('PushNotificationService: Token refresh error - $error');
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated notification taps
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Check if launched from notification
    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // Check if permission already granted
    final settings = await _messaging.getNotificationSettings();
    if (_isAuthorized(settings.authorizationStatus)) {
      await _registerToken();
    }

    _initialized = true;
    debugPrint('PushNotificationService: Initialized');
  }

  bool _isAuthorized(AuthorizationStatus status) =>
      status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;

  /// Initialize flutter_local_notifications for foreground display
  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (response) {
        // Handle notification tap from foreground (payload may be JSON with type + playId)
        if (response.payload != null && response.payload!.isNotEmpty) {
          try {
            final decoded = jsonDecode(response.payload!) as Map<String, dynamic>?;
            if (decoded != null) {
              onNotificationTap?.call(decoded);
              return;
            }
          } catch (_) {}
          onNotificationTap?.call({'type': response.payload});
        }
      },
    );

    // Create notification channel for Android
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'radio_alerts',
        'Radio Alerts',
        description: 'Notifications for when your song is about to play',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Request OS notification permission (iOS alert + Android 13+ runtime).
  Future<bool> requestPermissionLazy() async {
    final current = await _messaging.getNotificationSettings();
    if (_isAuthorized(current.authorizationStatus)) {
      await _registerToken();
      return true;
    }

    // Android 13+: also ask via the notifications plugin channel.
    if (Platform.isAndroid) {
      try {
        await _localNotifications
            .resolvePlatformSpecificImplementation<
                AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      } catch (e) {
        debugPrint(
          'PushNotificationService: Android notification permission - $e',
        );
      }
    }

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
    );

    final granted = _isAuthorized(settings.authorizationStatus);

    if (granted) {
      // Persist master toggle without re-entering permission request.
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('notifications_enabled', true);
      await _registerToken();
      return true;
    }

    debugPrint(
      'PushNotificationService: Permission denied '
      '(${settings.authorizationStatus})',
    );
    return false;
  }

  /// After first login / first home visit: explain why, then show the system
  /// Allow Notifications dialog so pushes can reach the device.
  Future<void> promptOnFirstLogin(BuildContext context) async {
    if (_firstLoginPromptInFlight || !context.mounted) return;
    _firstLoginPromptInFlight = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final alreadyPrompted = prefs.getBool(_firstLoginPromptKey) ?? false;

      final settings = await _messaging.getNotificationSettings();
      final status = settings.authorizationStatus;

      if (_isAuthorized(status)) {
        await prefs.setBool(_firstLoginPromptKey, true);
        await _registerToken();
        return;
      }

      // Already asked the OS once and denied — don't spam the system dialog.
      // Still show a one-time tip that they can enable later in Settings.
      if (alreadyPrompted && status == AuthorizationStatus.denied) {
        return;
      }

      if (!context.mounted) return;

      final wantsAlerts = await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (ctx) {
              return AlertDialog(
                title: const Text('Stay in the loop'),
                content: const Text(
                  'Allow notifications so we can alert you 5 minutes and '
                  '1 minute before a song plays, when artists you follow '
                  'upload or go live on a station, and when an app update '
                  'is ready.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Not now'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Allow notifications'),
                  ),
                ],
              );
            },
          ) ??
          false;

      await prefs.setBool(_firstLoginPromptKey, true);

      if (!wantsAlerts) {
        debugPrint('PushNotificationService: User skipped first-login prompt');
        return;
      }

      final granted = await requestPermissionLazy();
      if (!granted && context.mounted && status != AuthorizationStatus.denied) {
        // If the OS dialog was dismissed without grant, leave a soft tip.
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'You can enable notifications anytime in Settings.',
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('PushNotificationService: promptOnFirstLogin failed - $e');
    } finally {
      _firstLoginPromptInFlight = false;
    }
  }

  /// Wait briefly for the APNs device token — required before FCM getToken on iOS.
  Future<void> _waitForApnsToken() async {
    if (!Platform.isIOS) return;
    try {
      var apns = await _messaging.getAPNSToken();
      for (var i = 0; i < 12 && (apns == null || apns.isEmpty); i++) {
        await Future<void>.delayed(Duration(milliseconds: 250 * (i + 1)));
        apns = await _messaging.getAPNSToken();
      }
      if (apns == null || apns.isEmpty) {
        debugPrint(
          'PushNotificationService: APNs token not ready '
          '(check Push capability + Firebase APNs key)',
        );
      } else {
        debugPrint('PushNotificationService: APNs token ready');
      }
    } catch (e) {
      debugPrint('PushNotificationService: getAPNSToken failed - $e');
    }
  }

  /// Get FCM token and register with backend (always re-sync so server stays current).
  Future<void> _registerToken() async {
    try {
      await _waitForApnsToken();

      String? token = await _messaging.getToken();
      // Retry a few times — iOS often needs a beat after APNs registration.
      for (var i = 0; i < 5 && (token == null || token.isEmpty); i++) {
        await Future<void>.delayed(Duration(milliseconds: 400 * (i + 1)));
        await _waitForApnsToken();
        token = await _messaging.getToken();
      }

      if (token == null || token.isEmpty) {
        debugPrint('PushNotificationService: No FCM token available yet');
        return;
      }
      _currentToken = token;
      await _sendTokenToBackend(token);
      debugPrint(
        'PushNotificationService: Token registered - ${token.substring(0, 20)}...',
      );
    } catch (e) {
      debugPrint('PushNotificationService: Failed to get token - $e');
    }
  }

  /// Handle token refresh from FCM
  void _onTokenRefresh(String newToken) async {
    debugPrint(
      'PushNotificationService: Token refreshed - ${newToken.substring(0, 20)}...',
    );
    _currentToken = newToken;
    await _sendTokenToBackend(newToken);
  }

  /// Send token to backend API
  Future<void> _sendTokenToBackend(String token) async {
    try {
      await _apiService.post('push-notifications/register-device', {
        'fcmToken': token,
        'deviceType': Platform.isIOS ? 'ios' : 'android',
      });
    } catch (e) {
      debugPrint(
        'PushNotificationService: Failed to register token with backend - $e',
      );
    }
  }

  /// Re-register the FCM token after login (auth header now available).
  /// Does not show the system permission dialog — [promptOnFirstLogin] does that
  /// once the home screen is visible.
  Future<void> ensureRegisteredAfterAuth() async {
    try {
      final enabled = await NotificationSettingsService().notificationsEnabled;
      if (!enabled) return;
      final settings = await _messaging.getNotificationSettings();
      if (_isAuthorized(settings.authorizationStatus)) {
        await _registerToken();
      }
    } catch (e) {
      debugPrint(
        'PushNotificationService: ensureRegisteredAfterAuth failed - $e',
      );
    }
  }

  Future<bool> _shouldShowForeground(String? type) async {
    final settings = NotificationSettingsService();
    if (!await settings.notificationsEnabled) return false;
    switch (type) {
      case 'song_up_next':
      case 'song_up_next_5min':
      case 'up_next':
      case 'followed_artist_up_next':
      case 'followed_artist_up_next_5min':
        return await settings.upNextAlertsEnabled;
      case 'song_live_now':
      case 'live_now':
      case 'artist_song_on_radio':
      case 'artist_song_first_play':
        return await settings.liveNowAlertsEnabled;
      case 'song_approved':
      case 'song_rejected':
        return await settings.songApprovalAlertsEnabled;
      case 'followed_artist_new_upload':
      case 'app_update':
        return true;
      default:
        return true;
    }
  }

  /// Handle foreground messages - display as local notification
  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    debugPrint('PushNotificationService: Foreground message received');

    final type = message.data['type']?.toString();
    if (!await _shouldShowForeground(type)) return;

    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString();
    final body = notification?.body ?? message.data['body']?.toString();
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }

    final android = message.notification?.android;

    await _localNotifications.show(
      id: notification?.hashCode ??
          (type?.hashCode ?? DateTime.now().millisecondsSinceEpoch),
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          'radio_alerts',
          'Radio Alerts',
          channelDescription:
              'Alerts for radio plays, followed artists, and app updates',
          importance: Importance.high,
          priority: Priority.high,
          icon: android?.smallIcon ?? '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          threadIdentifier: 'radio_alerts',
          subtitle: 'NETWORX Radio',
        ),
      ),
      payload: message.data.isNotEmpty ? jsonEncode(message.data) : null,
    );
  }

  /// Handle notification tap (opens app from background/terminated)
  void _handleNotificationTap(RemoteMessage message) {
    debugPrint(
      'PushNotificationService: Notification tapped - ${message.data}',
    );
    final type = message.data['type']?.toString();
    final payload = Map<String, dynamic>.from(message.data);

    if (type == 'song_played' && message.data['playId'] != null) {
      onNotificationTap?.call({
        'type': 'song_played',
        'playId': message.data['playId'],
      });
      return;
    }

    // Artist about-to-play / live (backend uses song_up_next / song_live_now).
    if (type == 'up_next' ||
        type == 'live_now' ||
        type == 'song_up_next' ||
        type == 'song_live_now') {
      onNotificationTap?.call({
        'type': type,
        'songId': message.data['songId'],
        'songTitle': message.data['songTitle'],
        'radioId': message.data['radioId'],
      });
      return;
    }

    if (type == 'artist_live_now' && message.data['artistId'] != null) {
      onNotificationTap?.call({
        'type': 'artist_live_now',
        'artistId': message.data['artistId'],
      });
      return;
    }

    if (type == 'song_liked') {
      onNotificationTap?.call({'type': 'song_liked'});
      return;
    }

    if (type == 'artist_song_on_radio' || type == 'followed_artist_up_next') {
      onNotificationTap?.call({
        'type': type,
        'artistId': message.data['artistId'],
        'songId': message.data['songId'],
        'radioId': message.data['radioId'],
      });
      return;
    }

    if (type == 'app_update') {
      onNotificationTap?.call({
        'type': 'app_update',
        'storeUrl': message.data['storeUrl'],
        'latestVersion': message.data['latestVersion'],
        'forceUpdate': message.data['forceUpdate'],
      });
      return;
    }

    // Fallback: forward raw payload so callers can still react.
    if (type != null && type.isNotEmpty) {
      onNotificationTap?.call(payload);
    }
  }

  /// Unregister device token (call on logout)
  Future<void> unregisterToken() async {
    if (_currentToken != null) {
      try {
        await _apiService.post('push-notifications/unregister-device', {
          'fcmToken': _currentToken,
        });
        _currentToken = null;
        debugPrint('PushNotificationService: Token unregistered');
      } catch (e) {
        debugPrint('PushNotificationService: Failed to unregister token - $e');
      }
    }
  }

  /// Check if notifications are enabled
  Future<bool> areNotificationsEnabled() async {
    final settings = await _messaging.getNotificationSettings();
    return _isAuthorized(settings.authorizationStatus);
  }

  /// Get the current FCM token (for debugging)
  String? get currentToken => _currentToken;

  /// Ask the backend to send a diagnostic push to this account's devices.
  /// Returns a short human-readable summary (includes iOS APNs errors).
  Future<String> sendTestPush() async {
    // Make sure this device is registered before asking for a test.
    await requestPermissionLazy();
    try {
      final res = await _apiService.post('push-notifications/test', {});
      if (res is! Map) {
        return 'Test push failed: unexpected server response.';
      }
      final deviceCount = res['deviceCount'];
      final results = res['results'];
      if (deviceCount is num && deviceCount == 0) {
        return 'No devices registered for this account. '
            'Allow notifications, then try again while logged into the same account.';
      }
      if (results is! List || results.isEmpty) {
        return res['sent'] == true
            ? 'Test push sent.'
            : 'Test push failed.';
      }
      final lines = <String>[];
      for (final raw in results) {
        if (raw is! Map) continue;
        final type = (raw['deviceType'] ?? 'device').toString();
        final ok = raw['success'] == true;
        if (ok) {
          lines.add('$type: delivered');
        } else {
          final code = (raw['errorCode'] ?? 'error').toString();
          final msg = (raw['errorMessage'] ?? '').toString();
          lines.add(
            '$type: FAILED ($code)${msg.isEmpty ? '' : ' — $msg'}',
          );
        }
      }
      return lines.isEmpty ? 'Test push finished.' : lines.join('\n');
    } catch (e) {
      return 'Test push failed: $e';
    }
  }
}
