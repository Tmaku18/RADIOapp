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

private func networxLockReactDarwinCallback(
  _ center: CFNotificationCenter?,
  _ observer: UnsafeMutableRawPointer?,
  _ name: CFNotificationName?,
  _ object: UnsafeRawPointer?,
  _ userInfo: CFDictionary?
) {
  DispatchQueue.main.async {
    LiveActivityBridge.deliverLockReaction()
  }
}

enum LiveActivityBridge {
  private static var channel: FlutterMethodChannel?
  private static var updateChain: Task<Void, Never>?
  private static var observingMute = false
  private static var observingReact = false
  private static var lastArtworkToken = ""
  private static var lastArtworkUrl = ""

  static func register(messenger: FlutterBinaryMessenger) {
    let methodChannel = FlutterMethodChannel(
      name: "networx/live_activity",
      binaryMessenger: messenger
    )
    channel = methodChannel
    observeLockMute()
    observeLockReaction()
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
          isMuted: args?["isMuted"] as? Bool ?? false,
          songId: args?["songId"] as? String ?? "",
          playId: args?["playId"] as? String ?? ""
        )
        result(true)
      case "end":
        end()
        result(true)
      case "drain":
        deliverLockReaction()
        result(true)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
      deliverLockReaction()
    }
  }

  static func deliverLockMute() {
    channel?.invokeMethod("toggleMute", arguments: nil)
  }

  static func deliverLockReaction() {
    guard channel != nil else { return }
    let defaults = UserDefaults(suiteName: networxAppGroupId)
    let reaction = defaults?.string(forKey: networxLockReactionKey) ?? ""
    guard reaction == "fire" || reaction == "shit" else { return }
    let songId = defaults?.string(forKey: networxLockSongIdKey) ?? ""
    let playId = defaults?.string(forKey: networxLockPlayIdKey) ?? ""
    defaults?.removeObject(forKey: networxLockReactionKey)
    channel?.invokeMethod("react", arguments: [
      "reaction": reaction,
      "songId": songId,
      "playId": playId,
    ])
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

  private static func observeLockReaction() {
    if observingReact { return }
    observingReact = true
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      nil,
      networxLockReactDarwinCallback,
      networxLockReactNotification as CFString,
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
    isMuted: Bool,
    songId: String,
    playId: String
  ) {
    let defaults = UserDefaults(suiteName: networxAppGroupId)
    if !songId.isEmpty {
      defaults?.set(songId, forKey: networxLockSongIdKey)
    }
    defaults?.set(playId, forKey: networxLockPlayIdKey)
    enqueue {
      // Title first. Waiting on the artwork download left the card on the
      // previous song while the system player had already moved on.
      var state = NowPlayingAttributes.ContentState(
        title: title,
        artist: artist,
        station: station,
        isMuted: isMuted,
        artworkToken: lastArtworkToken
      )
      await publish(state)
      let token = await saveArtwork(from: artworkUrl)
      guard !token.isEmpty, token != state.artworkToken else { return }
      lastArtworkUrl = artworkUrl
      lastArtworkToken = token
      state.artworkToken = token
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
  static func endAll() {
    for activity in Activity<NowPlayingAttributes>.activities {
      Task { await activity.end(nil, dismissalPolicy: .immediate) }
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
