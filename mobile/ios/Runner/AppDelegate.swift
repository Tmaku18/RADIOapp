import Flutter
import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging
import flutter_local_notifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  /// APNs may arrive before Firebase Messaging is ready under
  /// FlutterImplicitEngineDelegate — hold it until plugins register.
  private var pendingApnsDeviceToken: Data?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Configure early so Messaging.apnsToken can be set before Dart boots.
    // Dart Firebase.initializeApp() is safe if already configured.
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }
    // Required for FCM → APNs delivery and foreground banner presentation.
    UNUserNotificationCenter.current().delegate = self
    // Register after plugin registration in didInitializeImplicitFlutterEngine
    // so Messaging can receive the APNs token (swizzling often misses it).
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    // Background notification isolate needs the same plugin set.
    FlutterLocalNotificationsPlugin.setPluginRegistrantCallback { registry in
      GeneratedPluginRegistrant.register(with: registry)
    }

    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    let channel = FlutterMethodChannel(
      name: "com.tmaktechnologies.networxradio/video_mirror",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      guard call.method == "mirrorHorizontally" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let args = call.arguments as? [String: Any],
        let path = args["path"] as? String,
        !path.isEmpty
      else {
        result(
          FlutterError(
            code: "bad_args",
            message: "Expected { path: String }",
            details: nil
          )
        )
        return
      }
      VideoMirror.mirrorHorizontally(inputPath: path) { mirrorResult in
        DispatchQueue.main.async {
          switch mirrorResult {
          case .success(let outputPath):
            result(outputPath)
          case .failure(let error):
            result(
              FlutterError(
                code: "mirror_failed",
                message: error.localizedDescription,
                details: nil
              )
            )
          }
        }
      }
    }

    if let token = pendingApnsDeviceToken {
      Messaging.messaging().apnsToken = token
      pendingApnsDeviceToken = nil
    }
    UIApplication.shared.registerForRemoteNotifications()
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Explicit handoff — required with FlutterImplicitEngineDelegate because
    // Firebase Messaging method swizzling often misses this callback.
    Messaging.messaging().apnsToken = deviceToken
    pendingApnsDeviceToken = nil
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("APNs registration failed: \(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
}
