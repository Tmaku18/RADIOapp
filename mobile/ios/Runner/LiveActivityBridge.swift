import ActivityKit
import Flutter
import Foundation
import UIKit

private func networxLockMuteDarwinCallback(
  _ center: CFNotificationCenter?,
  _ observer: UnsafeMutableRawPointer?,
  _ name: CFNotificationName?,
  _ object: UnsafeRawPointer?,
  _ userInfo: CFDictionary?
) {
  DispatchQueue.main.async {
    LiveActivityBridge.deliverLockMute()
  }
}

enum LiveActivityBridge {
  private static var channel: FlutterMethodChannel?
  private static var updateChain: Task<Void, Never>?
  private static var observingMute = false

  static func register(messenger: FlutterBinaryMessenger) {
    let methodChannel = FlutterMethodChannel(
      name: "networx/live_activity",
      binaryMessenger: messenger
    )
    channel = methodChannel
    observeLockMute()
    methodChannel.setMethodCallHandler { call, result in
      guard #available(iOS 16.2, *) else {
        result(false)
        return
      }
      switch call.method {
      case "update":
        let args = call.arguments as? [String: Any]
        update(
          title: args?["title"] as? String ?? "NetworX Radio",
          artist: args?["artist"] as? String ?? "",
          station: args?["station"] as? String ?? "NetworX Radio",
          artworkUrl: args?["artworkUrl"] as? String ?? "",
          isMuted: args?["isMuted"] as? Bool ?? false
        )
        result(true)
      case "end":
        end()
        result(true)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }

  static func deliverLockMute() {
    channel?.invokeMethod("toggleMute", arguments: nil)
  }

  private static func observeLockMute() {
    if observingMute { return }
    observingMute = true
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      nil,
      networxLockMuteDarwinCallback,
      networxLockMuteNotification as CFString,
      nil,
      .deliverImmediately
    )
  }

  @available(iOS 16.2, *)
  private static func update(
    title: String,
    artist: String,
    station: String,
    artworkUrl: String,
    isMuted: Bool
  ) {
    enqueue {
      let token = await saveArtwork(from: artworkUrl)
      let state = NowPlayingAttributes.ContentState(
        title: title,
        artist: artist,
        station: station,
        isMuted: isMuted,
        artworkToken: token
      )
      await publish(state)
    }
  }

  /// One card only. A second request used to stick around with an old song.
  @available(iOS 16.2, *)
  private static func publish(_ state: NowPlayingAttributes.ContentState) async {
    let content = ActivityContent(state: state, staleDate: nil)
    let existing = Activity<NowPlayingAttributes>.activities
    if existing.count > 1 {
      for activity in existing {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
    if let activity = Activity<NowPlayingAttributes>.activities.first {
      await activity.update(content)
      for extra in Activity<NowPlayingAttributes>.activities.dropFirst() {
        await extra.end(nil, dismissalPolicy: .immediate)
      }
      return
    }
    do {
      _ = try Activity.request(
        attributes: NowPlayingAttributes(stationId: state.station),
        content: content,
        pushType: nil
      )
    } catch {
      NSLog("Live Activity request failed: \(error.localizedDescription)")
    }
  }

  @available(iOS 16.2, *)
  private static func end() {
    enqueue {
      for activity in Activity<NowPlayingAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }

  private static func enqueue(_ work: @escaping () async -> Void) {
    let previous = updateChain
    let task = Task {
      await previous?.value
      await work()
    }
    updateChain = task
  }

  /// Writes a small cover into the app group so the lock screen can show it.
  private static func saveArtwork(from urlString: String) async -> String {
    let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let url = URL(string: trimmed) else { return "" }
    guard
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: networxAppGroupId
      )
    else { return "" }
    do {
      let (data, _) = try await URLSession.shared.data(from: url)
      guard let image = UIImage(data: data) else { return "" }
      let scaled = image.networxScaled(maxSide: 180)
      guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return "" }
      let file = container.appendingPathComponent(networxLockArtworkName)
      try jpeg.write(to: file, options: .atomic)
      return trimmed
    } catch {
      return ""
    }
  }
}

private extension UIImage {
  func networxScaled(maxSide: CGFloat) -> UIImage {
    let largest = max(size.width, size.height)
    guard largest > maxSide, largest > 0 else { return self }
    let ratio = maxSide / largest
    let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)
    let renderer = UIGraphicsImageRenderer(size: newSize)
    return renderer.image { _ in
      draw(in: CGRect(origin: .zero, size: newSize))
    }
  }
}
