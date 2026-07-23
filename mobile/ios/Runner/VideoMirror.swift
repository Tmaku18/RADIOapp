import AVFoundation
import Foundation

/// Horizontally mirrors a recorded video file.
/// Discover selfie recording does not use this path — front-camera capture
/// already sets `isVideoMirrored`, so preview and file match without a bake-in.
enum VideoMirror {
  enum MirrorError: LocalizedError {
    case missingInput
    case noVideoTrack
    case exportFailed(String)

    var errorDescription: String? {
      switch self {
      case .missingInput:
        return "Video file not found"
      case .noVideoTrack:
        return "No video track to mirror"
      case .exportFailed(let message):
        return message
      }
    }
  }

  static func mirrorHorizontally(
    inputPath: String,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    let inputURL = URL(fileURLWithPath: inputPath)
    guard FileManager.default.fileExists(atPath: inputPath) else {
      completion(.failure(MirrorError.missingInput))
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let outputPath = try Self.exportMirrored(inputURL: inputURL)
        completion(.success(outputPath))
      } catch {
        completion(.failure(error))
      }
    }
  }

  private static func exportMirrored(inputURL: URL) throws -> String {
    let asset = AVURLAsset(url: inputURL)
    guard let videoTrack = asset.tracks(withMediaType: .video).first else {
      throw MirrorError.noVideoTrack
    }

    let duration = asset.duration
    let naturalSize = videoTrack.naturalSize
    let preferredTransform = videoTrack.preferredTransform

    let composition = AVMutableComposition()
    guard
      let compositionVideoTrack = composition.addMutableTrack(
        withMediaType: .video,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    else {
      throw MirrorError.exportFailed("Could not create composition video track")
    }

    try compositionVideoTrack.insertTimeRange(
      CMTimeRange(start: .zero, duration: duration),
      of: videoTrack,
      at: .zero
    )

    if let audioTrack = asset.tracks(withMediaType: .audio).first,
      let compositionAudioTrack = composition.addMutableTrack(
        withMediaType: .audio,
        preferredTrackID: kCMPersistentTrackID_Invalid
      )
    {
      try? compositionAudioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: duration),
        of: audioTrack,
        at: .zero
      )
    }

    let transformed = naturalSize.applying(preferredTransform)
    let renderWidth = abs(transformed.width)
    let renderHeight = abs(transformed.height)
    guard renderWidth > 1, renderHeight > 1 else {
      throw MirrorError.exportFailed("Invalid video dimensions")
    }

    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = CGSize(width: renderWidth, height: renderHeight)
    let fps = videoTrack.nominalFrameRate
    let timescale = CMTimeScale(max(Int32(fps.rounded()), 30))
    videoComposition.frameDuration = CMTime(value: 1, timescale: timescale)

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: duration)

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(
      assetTrack: compositionVideoTrack
    )
    // Upright via preferredTransform, then flip horizontally in render space
    // so the file matches the on-screen selfie preview.
    let mirrored = preferredTransform
      .concatenating(CGAffineTransform(scaleX: -1, y: 1))
      .concatenating(CGAffineTransform(translationX: renderWidth, y: 0))
    layerInstruction.setTransform(mirrored, at: .zero)

    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    let outURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("selfie_mirror_\(UUID().uuidString).mp4")
    if FileManager.default.fileExists(atPath: outURL.path) {
      try FileManager.default.removeItem(at: outURL)
    }

    guard
      let export = AVAssetExportSession(
        asset: composition,
        presetName: AVAssetExportPresetHighestQuality
      )
    else {
      throw MirrorError.exportFailed("Could not create export session")
    }

    export.outputURL = outURL
    export.outputFileType = .mp4
    export.videoComposition = videoComposition
    export.shouldOptimizeForNetworkUse = true

    let semaphore = DispatchSemaphore(value: 0)
    var exportError: Error?
    export.exportAsynchronously {
      if export.status != .completed {
        exportError =
          export.error
          ?? MirrorError.exportFailed("Export status \(export.status.rawValue)")
      }
      semaphore.signal()
    }
    semaphore.wait()

    if let exportError {
      throw exportError
    }
    return outURL.path
  }
}
