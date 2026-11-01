import ActivityKit
import Flutter
import Foundation

enum LiveActivityBridge {
  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(
      name: "networx/live_activity",
      binaryMessenger: messenger
    )
    channel.setMethodCallHandler { call, result in
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
          station: args?["station"] as? String ?? "NetworX Radio"
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

  @available(iOS 16.2, *)
  private static func update(title: String, artist: String, station: String) {
    let state = NowPlayingAttributes.ContentState(
      title: title,
      artist: artist,
      station: station
    )
    let content = ActivityContent(state: state, staleDate: nil)
    Task {
      if let existing = Activity<NowPlayingAttributes>.activities.first {
        await existing.update(content)
        return
      }
      do {
        _ = try Activity.request(
          attributes: NowPlayingAttributes(stationId: station),
          content: content,
          pushType: nil
        )
      } catch {
        NSLog("Live Activity request failed: \(error.localizedDescription)")
      }
    }
  }

  @available(iOS 16.2, *)
  private static func end() {
    Task {
      for activity in Activity<NowPlayingAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}
