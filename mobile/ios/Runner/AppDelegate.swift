import Flutter
import UIKit
import AVFoundation
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

    let social = FlutterMethodChannel(
      name: "networx/social",
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    social.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(FlutterError(code: "unavailable", message: "Could not share", details: nil))
        return
      }
      self.handleSocial(call: call, result: result)
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

  private func handleSocial(call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any]
    switch call.method {
    case "attachAudio", "imageWithAudio":
      let audioPath = args?["audioPath"] as? String ?? ""
      let startMs = args?["startMs"] as? Int ?? 0
      let durationMs = args?["durationMs"] as? Int ?? 15000
      let videoPath = args?["videoPath"] as? String
      let imagePath = args?["imagePath"] as? String
      guard !audioPath.isEmpty, videoPath?.isEmpty == false || imagePath?.isEmpty == false else {
        result(FlutterError(code: "bad_args", message: "Expected a photo or video and a song", details: nil))
        return
      }
      ClipMux.export(
        videoPath: videoPath,
        imagePath: imagePath,
        audioPath: audioPath,
        startMs: startMs,
        durationMs: durationMs
      ) { muxResult in
        switch muxResult {
        case .success(let path):
          result(path)
        case .failure(let error):
          result(FlutterError(code: "mux_failed", message: error.localizedDescription, details: nil))
        }
      }
    case "burnOverlay":
      let videoPath = args?["videoPath"] as? String ?? ""
      let overlayPath = args?["overlayPath"] as? String ?? ""
      guard !videoPath.isEmpty, !overlayPath.isEmpty else {
        result(FlutterError(code: "bad_args", message: "Expected a clip and a credit", details: nil))
        return
      }
      ClipMux.burn(videoPath: videoPath, overlayPath: overlayPath) { muxResult in
        switch muxResult {
        case .success(let path):
          result(path)
        case .failure(let error):
          result(FlutterError(code: "mux_failed", message: error.localizedDescription, details: nil))
        }
      }
    case "share":
      let path = args?["path"] as? String ?? ""
      let target = args?["target"] as? String ?? ""
      guard !path.isEmpty, !target.isEmpty else {
        result(FlutterError(code: "bad_args", message: "Expected a file and a destination", details: nil))
        return
      }
      shareMedia(path: path, target: target, result: result)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func shareMedia(path: String, target: String, result: @escaping FlutterResult) {
    let isVideo = ["mp4", "mov", "m4v", "webm"].contains(
      URL(fileURLWithPath: path).pathExtension.lowercased()
    )
    if target == "instagram_story" || target == "instagram_post" {
      openInInstagram(path: path, video: isVideo, result: result)
      return
    }
    presentShareSheet(path: path, result: result)
  }

  private func openInInstagram(path: String, video: Bool, result: @escaping FlutterResult) {
    guard
      let scheme = URL(string: "instagram://app"),
      UIApplication.shared.canOpenURL(scheme)
    else {
      result(FlutterError(code: "not_installed", message: "Instagram is not installed", details: nil))
      return
    }
    let fileUrl = URL(fileURLWithPath: path)
    let document = UIDocumentInteractionController(url: fileUrl)
    document.uti = video ? "public.mpeg-4" : "com.instagram.photo"
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

  private func presentShareSheet(path: String, result: @escaping FlutterResult) {
    let fileUrl = URL(fileURLWithPath: path)
    DispatchQueue.main.async {
      guard let controller = Self.keyController() else {
        result(FlutterError(code: "unavailable", message: "Could not open the share sheet", details: nil))
        return
      }
      let activity = UIActivityViewController(activityItems: [fileUrl], applicationActivities: nil)
      activity.popoverPresentationController?.sourceView = controller.view
      controller.present(activity, animated: true) {
        result(true)
      }
    }
  }

  private static func keyView() -> UIView? {
    keyController()?.view
  }

  private static func keyController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
    var controller = window?.rootViewController
    while let presented = controller?.presentedViewController {
      controller = presented
    }
    return controller
  }
}

private enum ClipMuxError: LocalizedError {
  case missing
  case unreadable(String)
  case tooShort

  var errorDescription: String? {
    switch self {
    case .missing:
      return "The photo or song is missing"
    case .unreadable(let detail):
      return detail
    case .tooShort:
      return "The song ended before the clip"
    }
  }
}

/// Writes the on-air song into a photo or video. The mic track is left out.
private enum ClipMux {
  static func export(
    videoPath: String?,
    imagePath: String?,
    audioPath: String,
    startMs: Int,
    durationMs: Int,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let visual: URL
        if let videoPath, !videoPath.isEmpty {
          visual = URL(fileURLWithPath: videoPath)
        } else if let imagePath, !imagePath.isEmpty {
          visual = try stillVideo(
            imagePath: imagePath,
            durationMs: durationMs
          )
        } else {
          throw ClipMuxError.missing
        }
        let out = try mix(
          video: visual,
          audio: URL(fileURLWithPath: audioPath),
          startMs: startMs,
          durationMs: durationMs
        )
        DispatchQueue.main.async { completion(.success(out.path)) }
      } catch {
        DispatchQueue.main.async { completion(.failure(error)) }
      }
    }
  }

  static func burn(
    videoPath: String,
    overlayPath: String,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let asset = try loadAsset(URL(fileURLWithPath: videoPath))
        guard let image = UIImage(contentsOfFile: overlayPath)?.cgImage else {
          throw ClipMuxError.unreadable("Could not add the artist credit")
        }
        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
          throw ClipMuxError.unreadable("The video has no picture")
        }
        guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
          throw ClipMuxError.unreadable("The clip has no song")
        }
        let clip = videoTrack.timeRange.duration
        if clip.seconds < 0.4 {
          throw ClipMuxError.tooShort
        }
        let composition = AVMutableComposition()
        guard
          let compVideo = composition.addMutableTrack(
            withMediaType: .video,
            preferredTrackID: kCMPersistentTrackID_Invalid
          ),
          let compAudio = composition.addMutableTrack(
            withMediaType: .audio,
            preferredTrackID: kCMPersistentTrackID_Invalid
          )
        else {
          throw ClipMuxError.unreadable("Could not add the artist credit")
        }
        try compVideo.insertTimeRange(CMTimeRange(start: .zero, duration: clip), of: videoTrack, at: .zero)
        try compAudio.insertTimeRange(CMTimeRange(start: .zero, duration: clip), of: audioTrack, at: .zero)
        let transformed = CGRect(origin: .zero, size: videoTrack.naturalSize)
          .applying(videoTrack.preferredTransform)
        var render = CGSize(width: abs(transformed.width), height: abs(transformed.height))
        render.width = max(2, floor(render.width / 2) * 2)
        render.height = max(2, floor(render.height / 2) * 2)
        var fitted = videoTrack.preferredTransform
        fitted.tx -= transformed.origin.x
        fitted.ty -= transformed.origin.y
        let out = FileManager.default.temporaryDirectory
          .appendingPathComponent("networx-credit-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
        try? FileManager.default.removeItem(at: out)
        DispatchQueue.main.async {
          let parent = CALayer()
          let videoLayer = CALayer()
          let overlay = CALayer()
          let frame = CGRect(origin: .zero, size: render)
          parent.frame = frame
          videoLayer.frame = frame
          overlay.frame = frame
          overlay.contents = image
          overlay.contentsGravity = .resize
          overlay.isGeometryFlipped = true
          parent.addSublayer(videoLayer)
          parent.addSublayer(overlay)
          let instruction = AVMutableVideoCompositionInstruction()
          instruction.timeRange = CMTimeRange(start: .zero, duration: clip)
          let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: compVideo)
          layerInstruction.setTransform(fitted, at: .zero)
          instruction.layerInstructions = [layerInstruction]
          let videoComposition = AVMutableVideoComposition()
          videoComposition.renderSize = render
          videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
          videoComposition.instructions = [instruction]
          videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
            postProcessingAsVideoLayer: videoLayer,
            in: parent
          )
          guard let session = AVAssetExportSession(
            asset: composition,
            presetName: AVAssetExportPresetHighestQuality
          ) else {
            completion(.failure(ClipMuxError.unreadable("Could not add the artist credit")))
            return
          }
          session.outputURL = out
          session.outputFileType = .mp4
          session.shouldOptimizeForNetworkUse = true
          session.videoComposition = videoComposition
          session.exportAsynchronously {
            DispatchQueue.main.async {
              if session.status == .completed {
                completion(.success(out.path))
              } else {
                completion(.failure(
                  ClipMuxError.unreadable(session.error?.localizedDescription ?? "Could not add the artist credit")
                ))
              }
            }
          }
        }
      } catch {
        DispatchQueue.main.async { completion(.failure(error)) }
      }
    }
  }

  private static func loadAsset(_ url: URL) throws -> AVURLAsset {
    let asset = AVURLAsset(url: url)
    let keys = ["tracks", "duration"]
    let ready = DispatchSemaphore(value: 0)
    asset.loadValuesAsynchronously(forKeys: keys) { ready.signal() }
    ready.wait()
    for key in keys {
      var error: NSError?
      if asset.statusOfValue(forKey: key, error: &error) != .loaded {
        throw ClipMuxError.unreadable(error?.localizedDescription ?? "Could not read the clip")
      }
    }
    return asset
  }

  private static func mix(video: URL, audio: URL, startMs: Int, durationMs: Int) throws -> URL {
    let videoAsset = try loadAsset(video)
    let audioAsset = try loadAsset(audio)
    guard let videoTrack = videoAsset.tracks(withMediaType: .video).first else {
      throw ClipMuxError.unreadable("The video has no picture")
    }
    guard let audioTrack = audioAsset.tracks(withMediaType: .audio).first else {
      throw ClipMuxError.unreadable("The song has no audio")
    }
    let start = CMTime(value: CMTimeValue(max(0, startMs)), timescale: 1000)
    let wanted = CMTime(value: CMTimeValue(max(500, durationMs)), timescale: 1000)
    let videoClip = CMTimeMinimum(videoTrack.timeRange.duration, wanted)
    let remain = CMTimeSubtract(audioAsset.duration, start)
    let clip = CMTimeMinimum(videoClip, remain)
    if clip.seconds < 0.4 {
      throw ClipMuxError.tooShort
    }

    let composition = AVMutableComposition()
    guard
      let compVideo = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
      ),
      let compAudio = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    else {
      throw ClipMuxError.unreadable("Could not add the song")
    }
    try compVideo.insertTimeRange(CMTimeRange(start: .zero, duration: clip), of: videoTrack, at: .zero)
    compVideo.preferredTransform = videoTrack.preferredTransform
    try compAudio.insertTimeRange(CMTimeRange(start: start, duration: clip), of: audioTrack, at: .zero)

    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("networx-clip-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
    try? FileManager.default.removeItem(at: out)
    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else {
      throw ClipMuxError.unreadable("Could not add the song")
    }
    session.outputURL = out
    session.outputFileType = .mp4
    session.shouldOptimizeForNetworkUse = true
    let done = DispatchSemaphore(value: 0)
    session.exportAsynchronously { done.signal() }
    done.wait()
    if session.status != .completed {
      throw ClipMuxError.unreadable(session.error?.localizedDescription ?? "Could not add the song")
    }
    return out
  }

  private static func stillVideo(imagePath: String, durationMs: Int) throws -> URL {
    guard let image = UIImage(contentsOfFile: imagePath) else {
      throw ClipMuxError.missing
    }
    var width = min(image.size.width * image.scale, 1080)
    var height = width * (image.size.height / max(image.size.width, 1))
    if height > 1920 {
      height = 1920
      width = height * (image.size.width / max(image.size.height, 1))
    }
    width = floor(width / 2) * 2
    height = floor(height / 2) * 2
    if width < 2 { width = 720 }
    if height < 2 { height = 1280 }
    let size = CGSize(width: width, height: height)
    guard let buffer = pixelBuffer(from: image, size: size) else {
      throw ClipMuxError.unreadable("Could not read the photo")
    }

    let out = FileManager.default.temporaryDirectory
      .appendingPathComponent("networx-still-\(Int(Date().timeIntervalSince1970 * 1000)).mp4")
    try? FileManager.default.removeItem(at: out)
    let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: Int(size.width),
      AVVideoHeightKey: Int(size.height),
    ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
        kCVPixelBufferWidthKey as String: Int(size.width),
        kCVPixelBufferHeightKey as String: Int(size.height),
      ]
    )
    writer.add(input)
    guard writer.startWriting() else {
      throw ClipMuxError.unreadable(writer.error?.localizedDescription ?? "Could not save the photo")
    }
    writer.startSession(atSourceTime: .zero)
    let seconds = max(1, durationMs / 1000)
    for frame in 0...seconds {
      var spins = 0
      while !input.isReadyForMoreMediaData && spins < 400 {
        Thread.sleep(forTimeInterval: 0.005)
        spins += 1
      }
      if !input.isReadyForMoreMediaData {
        throw ClipMuxError.unreadable("Could not save the photo")
      }
      let time = CMTime(value: CMTimeValue(frame), timescale: 1)
      if !adaptor.append(buffer, withPresentationTime: time) {
        throw ClipMuxError.unreadable(writer.error?.localizedDescription ?? "Could not save the photo")
      }
    }
    input.markAsFinished()
    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    done.wait()
    if writer.status != .completed {
      throw ClipMuxError.unreadable(writer.error?.localizedDescription ?? "Could not save the photo")
    }
    return out
  }

  private static func pixelBuffer(from image: UIImage, size: CGSize) -> CVPixelBuffer? {
    let fitted = AVMakeRect(aspectRatio: image.size, insideRect: CGRect(origin: .zero, size: size))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = true
    let rendered = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      UIColor.black.setFill()
      UIBezierPath(rect: CGRect(origin: .zero, size: size)).fill()
      image.draw(in: fitted)
    }
    guard let cg = rendered.cgImage else { return nil }
    let attrs: [String: Any] = [
      kCVPixelBufferCGImageCompatibilityKey as String: true,
      kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
    ]
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
      kCFAllocatorDefault,
      Int(size.width),
      Int(size.height),
      kCVPixelFormatType_32ARGB,
      attrs as CFDictionary,
      &buffer
    )
    guard status == kCVReturnSuccess, let buffer else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let context = CGContext(
      data: CVPixelBufferGetBaseAddress(buffer),
      width: Int(size.width),
      height: Int(size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
    ) else { return nil }
    context.translateBy(x: 0, y: size.height)
    context.scaleBy(x: 1, y: -1)
    context.draw(cg, in: CGRect(origin: .zero, size: size))
    return buffer
  }
}
