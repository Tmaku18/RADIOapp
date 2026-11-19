import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

struct NowPlayingEntry: TimelineEntry {
  let date: Date
  let title: String
  let artist: String
}

struct NowPlayingProvider: TimelineProvider {
  func placeholder(in context: Context) -> NowPlayingEntry {
    NowPlayingEntry(date: Date(), title: "NetworX Radio", artist: "Tap to listen")
  }

  func getSnapshot(in context: Context, completion: @escaping (NowPlayingEntry) -> Void) {
    let defaults = UserDefaults(suiteName: networxAppGroupId)
    let title = defaults?.string(forKey: "title") ?? ""
    let artist = defaults?.string(forKey: "artist") ?? ""
    completion(
      NowPlayingEntry(
        date: Date(),
        title: title.isEmpty ? "NetworX Radio" : title,
        artist: artist.isEmpty ? "Tap to listen" : artist
      )
    )
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<NowPlayingEntry>) -> Void) {
    getSnapshot(in: context) { entry in
      completion(Timeline(entries: [entry], policy: .atEnd))
    }
  }
}

struct NowPlayingWidgetView: View {
  var entry: NowPlayingEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(entry.title)
        .font(.headline)
        .foregroundStyle(.white)
        .lineLimit(2)
      Text(entry.artist)
        .font(.subheadline)
        .foregroundStyle(Color(red: 0, green: 0.94, blue: 1))
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(12)
    .widgetURL(URL(string: "networxradio://radio"))
  }
}

struct NowPlayingHomeWidget: Widget {
  let kind: String = "NowPlayingWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: NowPlayingProvider()) { entry in
      if #available(iOS 17.0, *) {
        NowPlayingWidgetView(entry: entry)
          .containerBackground(Color.black, for: .widget)
      } else {
        NowPlayingWidgetView(entry: entry)
          .background(Color.black)
      }
    }
    .configurationDisplayName("Now Playing")
    .description("Shows the song playing on NetworX Radio.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

private let networxCyan = Color(red: 0, green: 0.94, blue: 1)

private func networxArtwork(token: String) -> Image? {
  guard !token.isEmpty,
        let container = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: networxAppGroupId
        ),
        let image = UIImage(
          contentsOfFile: container.appendingPathComponent(networxLockArtworkName).path
        )
  else { return nil }
  return Image(uiImage: image)
}

private struct LockScreenArtwork: View {
  let token: String
  let side: CGFloat

  var body: some View {
    Group {
      if let artwork = networxArtwork(token: token) {
        artwork.resizable().scaledToFill()
      } else {
        ZStack {
          Color.white.opacity(0.08)
          Image(systemName: "music.note")
            .font(.title2)
            .foregroundStyle(networxCyan)
        }
      }
    }
    .frame(width: side, height: side)
    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    .id(token)
  }
}

@available(iOS 17.0, *)
private struct LockScreenMuteButton: View {
  let isMuted: Bool
  var compact = false

  var body: some View {
    Button(intent: ToggleRadioMuteIntent()) {
      VStack(spacing: compact ? 2 : 4) {
        Image(systemName: isMuted ? "speaker.slash.fill" : "speaker.wave.2.fill")
          .font(compact ? .body : .title2)
        Text(isMuted ? "Muted" : "Mute")
          .font(.caption2)
      }
      .foregroundStyle(isMuted ? Color.white.opacity(0.7) : networxCyan)
      .frame(width: compact ? 52 : 64, height: compact ? 52 : 72)
      .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    .buttonStyle(.plain)
  }
}

@available(iOS 17.0, *)
private struct LockScreenReactionButton: View {
  let emoji: String
  let fire: Bool

  var body: some View {
    Group {
      if fire {
        Button(intent: FireSongIntent()) { label }
      } else {
        Button(intent: ShitSongIntent()) { label }
      }
    }
    .buttonStyle(.plain)
  }

  private var label: some View {
    Text(emoji)
      .font(.title2)
      .frame(width: 64, height: 36)
  }
}

private struct LockScreenNowPlaying: View {
  let state: NowPlayingAttributes.ContentState

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(spacing: 4) {
        LockScreenArtwork(token: state.artworkToken, side: 64)
        if #available(iOS 17.0, *) {
          LockScreenReactionButton(emoji: "💩", fire: false)
        }
      }
      VStack(spacing: 2) {
        Text(state.station)
          .font(.caption)
          .foregroundStyle(networxCyan)
          .lineLimit(1)
        Text(state.title)
          .font(.title3)
          .fontWeight(.bold)
          .foregroundStyle(.white)
          .lineLimit(2)
        Text(state.artist)
          .font(.subheadline)
          .foregroundStyle(.white.opacity(0.72))
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
      if #available(iOS 17.0, *) {
        LockScreenMuteButton(isMuted: state.isMuted)
      }
    }
    .padding(.horizontal, 14)
    .padding(.top, 12)
    .padding(.bottom, 40)
    .frame(maxWidth: .infinity, minHeight: 148, alignment: .top)
    .overlay(alignment: .bottomTrailing) {
      if #available(iOS 17.0, *) {
        LockScreenReactionButton(emoji: "🔥", fire: true)
          .padding(.bottom, 2)
          .padding(.trailing, 14)
      }
    }
  }
}

struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      LockScreenNowPlaying(state: context.state)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(.white)
        .widgetURL(URL(string: "networxradio://radio"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          LockScreenArtwork(token: context.state.artworkToken, side: 44)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if #available(iOS 17.0, *) {
            LockScreenMuteButton(isMuted: context.state.isMuted, compact: true)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.station)
            .font(.caption2)
            .foregroundStyle(networxCyan)
          Text(context.state.title).font(.headline).lineLimit(1)
          Text(context.state.artist).font(.subheadline).lineLimit(1)
        }
      } compactLeading: {
        Text("NX")
          .font(.caption2)
          .foregroundStyle(networxCyan)
      } compactTrailing: {
        Text(context.state.title).lineLimit(1).font(.caption2)
      } minimal: {
        Text("NX")
          .font(.caption2)
          .foregroundStyle(networxCyan)
      }
      .widgetURL(URL(string: "networxradio://radio"))
    }
  }
}

@main
struct NowPlayingWidgets: WidgetBundle {
  var body: some Widget {
    NowPlayingHomeWidget()
    NowPlayingLiveActivity()
  }
}
