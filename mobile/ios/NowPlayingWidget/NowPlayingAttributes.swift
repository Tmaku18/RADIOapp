import ActivityKit
import Foundation

let networxAppGroupId = "group.com.tmaktechnologies.networxradio"

@available(iOS 16.1, *)
struct NowPlayingAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var artist: String
    var station: String
  }

  var stationId: String
}
