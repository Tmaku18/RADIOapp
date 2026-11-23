import AppIntents
import Foundation

#if canImport(ActivityKit)
import ActivityKit
#endif

/// Lock-screen mute. Runs in the widget, then asks the playing app to mute.
@available(iOS 17.0, *)
struct ToggleRadioMuteIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Mute radio"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    #if canImport(ActivityKit)
    if #available(iOS 16.2, *) {
      var nextMuted: Bool?
      for activity in Activity<NowPlayingAttributes>.activities {
        var state = activity.content.state
        state.isMuted.toggle()
        nextMuted = state.isMuted
        await activity.update(ActivityContent(state: state, staleDate: nil))
      }
      if let nextMuted {
        // Absolute value plus a time, so a song update already in flight
        // cannot paint Mute back over Unmute.
        let defaults = UserDefaults(suiteName: networxAppGroupId)
        defaults?.set(nextMuted ? "true" : "false", forKey: networxLockMutedKey)
        defaults?.set(Date().timeIntervalSince1970, forKey: networxLockMutedAtKey)
        defaults?.synchronize()
      }
    }
    #endif
    let name = CFNotificationName(networxLockMuteNotification as CFString)
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      name,
      nil,
      nil,
      true
    )
    return .result()
  }
}

/// Lock-screen fire. Votes on the playing song without opening the app.
@available(iOS 17.0, *)
struct FireSongIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Fire"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    await postLockReaction("fire")
    return .result()
  }
}

/// Lock-screen pass. Votes on the playing song without opening the app.
@available(iOS 17.0, *)
struct ShitSongIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pass"
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult {
    await postLockReaction("shit")
    return .result()
  }
}

@available(iOS 17.0, *)
private func postLockReaction(_ reaction: String) async {
  let defaults = UserDefaults(suiteName: networxAppGroupId)
  defaults?.set(reaction, forKey: networxLockReactionKey)
  defaults?.set(reaction, forKey: networxLockReactionShownKey)
  defaults?.set(defaults?.string(forKey: networxLockSongIdKey) ?? "", forKey: networxLockReactionSongKey)
  defaults?.synchronize()
  #if canImport(ActivityKit)
  for activity in Activity<NowPlayingAttributes>.activities {
    var state = activity.content.state
    state.reaction = reaction
    await activity.update(ActivityContent(state: state, staleDate: nil))
  }
  #endif
  let name = CFNotificationName(networxLockReactNotification as CFString)
  CFNotificationCenterPostNotification(
    CFNotificationCenterGetDarwinNotifyCenter(),
    name,
    nil,
    nil,
    true
  )
}
