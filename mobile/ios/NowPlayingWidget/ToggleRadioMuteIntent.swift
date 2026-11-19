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
      for activity in Activity<NowPlayingAttributes>.activities {
        var state = activity.content.state
        state.isMuted.toggle()
        await activity.update(ActivityContent(state: state, staleDate: nil))
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
