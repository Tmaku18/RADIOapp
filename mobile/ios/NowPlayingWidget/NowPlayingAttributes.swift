import ActivityKit
import Foundation

let networxAppGroupId = "group.com.tmaktechnologies.networxradio"
let networxLockArtworkName = "live-artwork.jpg"
let networxLockMuteNotification = "com.tmaktechnologies.networxradio.lockMute"
let networxLockReactNotification = "com.tmaktechnologies.networxradio.lockReact"
let networxLockReactionKey = "lockReaction"
let networxLockSongIdKey = "lockSongId"
let networxLockPlayIdKey = "lockPlayId"
let networxLockMutedKey = "lockMuted"
let networxLockMutedAtKey = "lockMutedAt"

@available(iOS 16.1, *)
struct NowPlayingAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var artist: String
    var station: String
    var isMuted: Bool
    var artworkToken: String

    init(
      title: String,
      artist: String,
      station: String,
      isMuted: Bool = false,
      artworkToken: String = ""
    ) {
      self.title = title
      self.artist = artist
      self.station = station
      self.isMuted = isMuted
      self.artworkToken = artworkToken
    }

    private enum CodingKeys: String, CodingKey {
      case title, artist, station, isMuted, artworkToken
    }

    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      title = try container.decodeIfPresent(String.self, forKey: .title) ?? "NetworX Radio"
      artist = try container.decodeIfPresent(String.self, forKey: .artist) ?? ""
      station = try container.decodeIfPresent(String.self, forKey: .station) ?? "NetworX Radio"
      isMuted = try container.decodeIfPresent(Bool.self, forKey: .isMuted) ?? false
      artworkToken = try container.decodeIfPresent(String.self, forKey: .artworkToken) ?? ""
    }

    func encode(to encoder: Encoder) throws {
      var container = encoder.container(keyedBy: CodingKeys.self)
      try container.encode(title, forKey: .title)
      try container.encode(artist, forKey: .artist)
      try container.encode(station, forKey: .station)
      try container.encode(isMuted, forKey: .isMuted)
      try container.encode(artworkToken, forKey: .artworkToken)
    }
  }

  var stationId: String
}
