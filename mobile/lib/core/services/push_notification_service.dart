import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'api_service.dart';

/// Push notification service with production-grade features:
/// - Lazy permission: Request only on first upload or "Notify me" toggle
/// - Token refresh: Listen to onTokenRefresh stream
/// - Foreground notifications: Display using flutter_local_notifications
/// - Deep linking: Navigate to player on notification tap
class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final ApiService _apiService = ApiService();
  
  bool _initialized = false;
  bool _permissionRequested = false;
  String? _currentToken;

  // Callback for handling notification taps
  Function(Map<String, dynamic>)? onNotificationTap;

  /// Initialize the push notification service (call after Firebase init)
  Future<void> initialize() async {
    if (_initialized) return;

    // Initialize local notifications for foreground display
    await _initializeLocalNotifications();

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
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      await _registerToken();
    }

    _initialized = true;
    debugPrint('PushNotificationService: Initialized');
  }

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
      initSettings,
      onDidReceiveNotificationResponse: (response) {
        // Handle notification tap from foreground
        if (response.payload != null) {
          onNotificationTap?.call({'type': 'local', 'payload': response.payload});
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
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Request permission lazily - call when artist uploads first track or toggles "Notify me"
  Future<bool> requestPermissionLazy() async {
    if (_permissionRequested) {
      final settings = await _messaging.getNotificationSettings();
      return settings.authorizationStatus == AuthorizationStatus.authorized;
    }

    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false, // Require explicit permission
      announcement: false,
      carPlay: false,
      criticalAlert: false,
    );

    _permissionRequested = true;

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      await _registerToken();
      return true;
    }

    debugPrint('PushNotificationService: Permission denied');
    return false;
  }

  /// Get FCM token and register with backend
  Future<void> _registerToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null && token != _currentToken) {
        _currentToken = token;
        await _sendTokenToBackend(token);
        debugPrint('PushNotificationService: Token registered - ${token.substring(0, 20)}...');
      }
    } catch (e) {
      debugPrint('PushNotificationService: Failed to get token - $e');
    }
  }

  /// Handle token refresh from FCM
  void _onTokenRefresh(String newToken) async {
    debugPrint('PushNotificationService: Token refreshed - ${newToken.substring(0, 20)}...');
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
      debugPrint('PushNotificationService: Failed to register token with backend - $e');
    }
  }

  /// Handle foreground messages - display as local notification
  void _handleForegroundMessage(RemoteMessage message) {
    debugPrint('PushNotificationService: Foreground message received');
    
    final notification = message.notification;
    final android = message.notification?.android;

    // Show local notification for foreground messages
    if (notification != null) {
      _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            'radio_alerts',
            'Radio Alerts',
            channelDescription: 'Notifications for when your song is about to play',
            importance: Importance.high,
            priority: Priority.high,
            icon: android?.smallIcon ?? '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
        payload: message.data['type'],
      );
    }
  }

  /// Handle notification tap (opens app from background/terminated)
  void _handleNotificationTap(RemoteMessage message) {
    debugPrint('PushNotificationService: Notification tapped - ${message.data}');
    
    // Navigate based on notification type
    final type = message.data['type'];
    
    if (type == 'up_next' || type == 'live_now') {
      // Navigate to player screen
      onNotificationTap?.call({
        'type': type,
        'songId': message.data['songId'],
        'songTitle': message.data['songTitle'],
      });
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
    return settings.authorizationStatus == AuthorizationStatus.authorized;
  }

  /// Get the current FCM token (for debugging)
  String? get currentToken => _currentToken;
}
