import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Required for FCM → APNs delivery and foreground banner presentation.
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
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
  }
}
