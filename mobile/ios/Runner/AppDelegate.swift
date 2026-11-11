import Flutter
import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging
import flutter_local_notifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, UIDocumentInteractionControllerDelegate {
  /// APNs may arrive before Firebase Messaging is ready under
  /// FlutterImplicitEngineDelegate — hold it until plugins register.
  private var pendingApnsDeviceToken: Data?
  /// Kept alive while the Instagram open-in menu is on screen.
  private var instagramDocument: UIDocumentInteractionController?

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
    let instagram = FlutterMethodChannel(
      name: "networx/instagram",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    LiveActivityBridge.register(messenger: engineBridge.applicationRegistrar.messenger())
    PlaybackVisualizer.register(messenger: engineBridge.applicationRegistrar.messenger())

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

    instagram.setMethodCallHandler { [weak self] call, result in
      guard call.method == "shareImage" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard
        let args = call.arguments as? [String: Any],
        let path = args["path"] as? String,
        !path.isEmpty
      else {
        result(FlutterError(code: "bad_args", message: "Expected a PNG path", details: nil))
        return
      }
      self?.shareImageToInstagram(path: path, result: result)
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

  private func shareImageToInstagram(path: String, result: @escaping FlutterResult) {
    guard
      let scheme = URL(string: "instagram://app"),
      UIApplication.shared.canOpenURL(scheme)
    else {
      result(FlutterError(code: "not_installed", message: "Instagram is not installed", details: nil))
      return
    }
    let fileUrl = URL(fileURLWithPath: path)
    let document = UIDocumentInteractionController(url: fileUrl)
    document.uti = "com.instagram.photo"
    document.delegate = self
    instagramDocument = document
    guard let view = Self.keyView() else {
      result(FlutterError(code: "unavailable", message: "Could not open Instagram", details: nil))
      return
    }
    let opened = document.presentOpenInMenu(from: view.bounds, in: view, animated: true)
    if opened {
      result(true)
    } else {
      result(FlutterError(code: "unavailable", message: "Could not open Instagram", details: nil))
    }
  }

  private static func keyView() -> UIView? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
    return window?.rootViewController?.view
  }
}
