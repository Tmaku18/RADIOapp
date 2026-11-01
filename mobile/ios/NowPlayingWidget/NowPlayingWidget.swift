import ActivityKit
import SwiftUI
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

struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.station)
          .font(.caption)
          .foregroundStyle(Color(red: 0, green: 0.94, blue: 1))
        Text(context.state.title)
          .font(.headline)
          .lineLimit(1)
        Text(context.state.artist)
          .font(.subheadline)
          .lineLimit(1)
      }
      .padding()
      .activityBackgroundTint(Color.black)
      .activitySystemActionForegroundColor(.white)
      .widgetURL(URL(string: "networxradio://radio"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.state.station)
            .font(.caption2)
            .foregroundStyle(Color(red: 0, green: 0.94, blue: 1))
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.title).font(.headline).lineLimit(1)
          Text(context.state.artist).font(.subheadline).lineLimit(1)
        }
      } compactLeading: {
        Text("NX")
          .font(.caption2)
          .foregroundStyle(Color(red: 0, green: 0.94, blue: 1))
      } compactTrailing: {
        Text(context.state.title).lineLimit(1).font(.caption2)
      } minimal: {
        Text("NX")
          .font(.caption2)
          .foregroundStyle(Color(red: 0, green: 0.94, blue: 1))
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
