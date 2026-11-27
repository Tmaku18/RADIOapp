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
  /// Bumped on every song update so a slow cover download cannot republish
  /// the previous title over the song that is actually playing.
  private static var updateGeneration = 0
  /// False after the listener leaves a pause that started in the app, or
  /// after an outside pause is handed to the system to remove later.
  /// Song ticks must not start a new card until they listen again.
  private static var acceptUpdates = true

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
        guard acceptUpdates else {
          result(true)
          return
        }
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
      case "endHold":
        acceptUpdates = false
        end()
        result(true)
      case "allowUpdates":
        acceptUpdates = true
        result(true)
      case "replaceCard":
        acceptUpdates = true
        end()
        result(true)
      case "armDismiss":
        let seconds = (call.arguments as? [String: Any])?["seconds"] as? NSNumber
        armDismiss(after: seconds?.doubleValue ?? (30 * 60))
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
    // Captured before the queue waits, so a mute tap during an in-flight
    // song update still wins.
    let requestedAt = Date().timeIntervalSince1970
    updateGeneration += 1
    let generation = updateGeneration
    enqueue {
      // A newer song already replaced this one while it waited.
      guard generation == updateGeneration else { return }
      let state = NowPlayingAttributes.ContentState(
        title: title,
        artist: artist,
        station: station,
        isMuted: mutedPreferringCard(isMuted, requestedAt: requestedAt),
        artworkToken: lastArtworkToken,
        reaction: shownReaction(songId: songId)
      )
      await publish(state)
    }
    // Cover art must not block the next title. The previous download used
    // to finish late and paint the old song back onto the card.
    Task {
      let token = await saveArtwork(from: artworkUrl, generation: generation)
      guard generation == updateGeneration else { return }
      guard !token.isEmpty, token != lastArtworkToken else { return }
      lastArtworkUrl = artworkUrl
      lastArtworkToken = token
      enqueue {
        guard acceptUpdates else { return }
        guard generation == updateGeneration else { return }
        var state = NowPlayingAttributes.ContentState(
          title: title,
          artist: artist,
          station: station,
          isMuted: mutedPreferringCard(isMuted, requestedAt: requestedAt),
          artworkToken: token,
          reaction: shownReaction(songId: songId)
        )
        if let live = Activity<NowPlayingAttributes>.activities.first {
          state.isMuted = live.content.state.isMuted
        }
        state.isMuted = mutedPreferringCard(state.isMuted, requestedAt: requestedAt)
        await publish(state)
      }
    }
  }

  /// The emoji the listener just tapped. A different song clears it.
  private static func shownReaction(songId: String) -> String {
    let defaults = UserDefaults(suiteName: networxAppGroupId)
    let votedSong = defaults?.string(forKey: networxLockReactionSongKey) ?? ""
    let shown = defaults?.string(forKey: networxLockReactionShownKey) ?? ""
    let known = shown == "fire" || shown == "shit"
    guard !songId.isEmpty, votedSong == songId, known else { return "" }
    return shown
  }

  /// A mute tap on the island writes a newer value than this update. Keep it.
  private static func mutedPreferringCard(_ requested: Bool, requestedAt: TimeInterval) -> Bool {
    let defaults = UserDefaults(suiteName: networxAppGroupId)
    let tappedAt = defaults?.double(forKey: networxLockMutedAtKey) ?? 0
    guard tappedAt > requestedAt,
          let raw = defaults?.string(forKey: networxLockMutedKey)
    else { return requested }
    if raw == "true" { return true }
    if raw == "false" { return false }
    return requested
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
    // A pause already told the system to drop the card. Do not start another.
    guard acceptUpdates else { return }
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

  /// Keep the paused card long enough to resume, then let the system remove
  /// it even if this process is suspended. A later song update cannot start
  /// a second card while [acceptUpdates] is false.
  @available(iOS 16.2, *)
  private static func armDismiss(after seconds: TimeInterval) {
    acceptUpdates = false
    let lifetime = max(seconds, 1)
    let deadline = Date().addingTimeInterval(lifetime)
    enqueue {
      for activity in Activity<NowPlayingAttributes>.activities {
        let content = ActivityContent(state: activity.content.state, staleDate: nil)
        await activity.end(content, dismissalPolicy: .after(deadline))
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
  private static func saveArtwork(from urlString: String, generation: Int) async -> String {
    let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, let url = URL(string: trimmed) else { return "" }
    guard
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: networxAppGroupId
      )
    else { return "" }
    do {
      var request = URLRequest(url: url)
      request.timeoutInterval = 8
      let (data, _) = try await URLSession.shared.data(for: request)
      guard generation == updateGeneration else { return "" }
      guard let image = UIImage(data: data) else { return "" }
      let scaled = image.networxScaled(maxSide: 180)
      guard let jpeg = scaled.jpegData(compressionQuality: 0.72) else { return "" }
      guard generation == updateGeneration else { return "" }
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
