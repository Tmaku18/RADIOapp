import AVFoundation
import Accelerate
import Flutter
import Foundation
import MediaToolbox
import ObjectiveC

/// Taps the app's own player (the same AVQueuePlayer just_audio uses) and
/// forwards a short FFT to Flutter on `networx/visualizer/fft`. The byte layout
/// matches Android's Visualizer capture so Dart can share one processor.
/// Samples are only read; playback is passed through unchanged.
final class PlaybackVisualizer: NSObject {
  static let shared = PlaybackVisualizer()

  private let fftSize = 1024
  private let log2n: vDSP_Length = 10
  private let packetSize = 256

  private var eventSink: FlutterEventSink?
  private var enabled = false
  private var swizzled = false
  private var timer: Timer?
  private var fftSetup: FFTSetup?

  private var window = [Float](repeating: 0, count: 1024)
  private var timeDomain = [Float](repeating: 0, count: 1024)
  private var realp = [Float](repeating: 0, count: 512)
  private var imagp = [Float](repeating: 0, count: 512)
  private var ring = [Float](repeating: 0, count: 1024)
  private var ringCount = 0
  private var packet = [UInt8](repeating: 0, count: 256)
  private var scratch = [UInt8](repeating: 0, count: 256)
  private var hasNewPacket = false
  private var lastLoudAt: TimeInterval = 0

  private var formatReady = false
  private var isFloat = true
  private var nonInterleaved = false
  private var channels = 2
  private var bits = 32

  private let stateLock = NSLock()
  private var attachedItems = Set<ObjectIdentifier>()
  private var pendingItems = Set<ObjectIdentifier>()
  private var retryAt = [ObjectIdentifier: TimeInterval]()

  private let audioLock: UnsafeMutablePointer<os_unfair_lock> = {
    let pointer = UnsafeMutablePointer<os_unfair_lock>.allocate(capacity: 1)
    pointer.initialize(to: os_unfair_lock())
    return pointer
  }()

  static func register(messenger: FlutterBinaryMessenger) {
    let methods = FlutterMethodChannel(
      name: "networx/visualizer",
      binaryMessenger: messenger
    )
    methods.setMethodCallHandler { call, result in
      switch call.method {
      case "hasPermission", "requestPermission":
        // The tap reads the player, not the microphone.
        result(true)
      case "attach":
        shared.start()
        result(true)
      case "detach":
        shared.stop()
        result(true)
      default:
        result(FlutterMethodNotImplemented)
      }
    }

    let events = FlutterEventChannel(
      name: "networx/visualizer/fft",
      binaryMessenger: messenger
    )
    events.setStreamHandler(shared)
  }

  private func start() {
    enabled = true
    installHook()
    if fftSetup == nil {
      fftSetup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2))
      window.withUnsafeMutableBufferPointer { buffer in
        guard let base = buffer.baseAddress else { return }
        vDSP_hann_window(base, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))
      }
    }
    startTimer()
  }

  private func stop() {
    enabled = false
    timer?.invalidate()
    timer = nil
    stateLock.lock()
    hasNewPacket = false
    stateLock.unlock()
  }

  private func startTimer() {
    if timer != nil { return }
    let timer = Timer(timeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
      self?.emit()
    }
    RunLoop.main.add(timer, forMode: .common)
    self.timer = timer
  }

  private func emit() {
    guard let eventSink else { return }
    stateLock.lock()
    let fresh = hasNewPacket
    var bytes = [UInt8](repeating: 0, count: packetSize)
    if fresh {
      for i in 0..<packetSize { bytes[i] = packet[i] }
      hasNewPacket = false
    }
    stateLock.unlock()
    guard fresh else { return }
    eventSink(FlutterStandardTypedData(bytes: Data(bytes)))
  }

  private func installHook() {
    guard !swizzled else { return }
    swizzled = true
    guard
      let original = class_getInstanceMethod(
        AVPlayer.self,
        #selector(getter: AVPlayer.currentItem)
      ),
      let hooked = class_getInstanceMethod(
        AVPlayer.self,
        #selector(AVPlayer.nx_visualizer_currentItem)
      )
    else { return }
    method_exchangeImplementations(original, hooked)
  }

  fileprivate func note(_ item: AVPlayerItem) {
    guard enabled else { return }
    let id = ObjectIdentifier(item)
    let now = CACurrentMediaTime()
    stateLock.lock()
    if attachedItems.contains(id) || pendingItems.contains(id) {
      stateLock.unlock()
      return
    }
    if let retry = retryAt[id], now < retry {
      stateLock.unlock()
      return
    }
    pendingItems.insert(id)
    stateLock.unlock()

    DispatchQueue.main.async { [weak self, weak item] in
      guard let self, let item else { return }
      self.installTap(on: item)
    }
  }

  private func installTap(on item: AVPlayerItem) {
    let id = ObjectIdentifier(item)
    let asset = item.asset
    asset.loadValuesAsynchronously(forKeys: ["tracks"]) { [weak self, weak item] in
      DispatchQueue.main.async {
        guard let self, let item else { return }
        let status = asset.statusOfValue(forKey: "tracks", error: nil)
        let tracks = status == .loaded ? asset.tracks(withMediaType: .audio) : []
        guard let track = tracks.first else {
          self.stateLock.lock()
          self.pendingItems.remove(id)
          self.retryAt[id] = CACurrentMediaTime() + 0.6
          self.stateLock.unlock()
          return
        }
        guard self.attachTap(to: item, track: track) else {
          self.stateLock.lock()
          self.pendingItems.remove(id)
          self.retryAt[id] = CACurrentMediaTime() + 1.0
          self.stateLock.unlock()
          return
        }
        self.stateLock.lock()
        self.pendingItems.remove(id)
        self.attachedItems.insert(id)
        self.retryAt[id] = nil
        self.stateLock.unlock()
      }
    }
  }

  private func attachTap(to item: AVPlayerItem, track: AVAssetTrack) -> Bool {
    if item.audioMix != nil { return true }
    var callbacks = MTAudioProcessingTapCallbacks(
      version: kMTAudioProcessingTapCallbacksVersion_0,
      clientInfo: Unmanaged.passUnretained(self).toOpaque(),
      init: tapInit,
      finalize: tapFinalize,
      prepare: tapPrepare,
      unprepare: tapUnprepare,
      process: tapProcess
    )

    var tap: MTAudioProcessingTap?
    let status = MTAudioProcessingTapCreate(
      kCFAllocatorDefault,
      &callbacks,
      kMTAudioProcessingTapCreationFlag_PostEffects,
      &tap
    )
    guard status == noErr, let tap else { return false }

    let params = AVMutableAudioMixInputParameters(track: track)
    params.audioTapProcessor = tap
    // Mix volume multiplies the player volume. 1 keeps pause-mute and the
    // listener's own level in charge.
    params.setVolume(1, at: .zero)
    let mix = AVMutableAudioMix()
    mix.inputParameters = [params]
    item.audioMix = mix
    return true
  }

  fileprivate func prepare(_ asbd: AudioStreamBasicDescription) {
    let flags = asbd.mFormatFlags
    if os_unfair_lock_trylock(audioLock) {
      isFloat = (flags & kAudioFormatFlagIsFloat) != 0
      nonInterleaved = (flags & kAudioFormatFlagIsNonInterleaved) != 0
      channels = max(1, Int(asbd.mChannelsPerFrame))
      bits = Int(asbd.mBitsPerChannel)
      formatReady = true
      ringCount = 0
      os_unfair_lock_unlock(audioLock)
    }
  }

  fileprivate func analyze(
    _ bufferList: UnsafeMutablePointer<AudioBufferList>,
    frames: Int
  ) {
    guard frames > 0 else { return }
    guard os_unfair_lock_trylock(audioLock) else { return }
    defer { os_unfair_lock_unlock(audioLock) }
    guard formatReady else { return }

    let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
    guard let first = buffers.first, let data = first.mData, first.mDataByteSize > 0 else {
      return
    }

    let now = CACurrentMediaTime()
    let peak = bufferPeak(data: data, byteCount: Int(first.mDataByteSize), frames: frames)
    // A paused or silent second player (the DJ voice) must not wipe a live
    // music spectrum. Ignore a quiet tap while another was loud moments ago.
    if peak < 0.004 && now - lastLoudAt < 0.25 { return }
    if peak >= 0.004 { lastLoudAt = now }
    pushBuffer(data: data, byteCount: Int(first.mDataByteSize), frames: frames)
  }

  private func bufferPeak(
    data: UnsafeMutableRawPointer,
    byteCount: Int,
    frames: Int
  ) -> Float {
    var peak: Float = 0
    visitSamples(data: data, byteCount: byteCount, frames: frames) { sample in
      peak = max(peak, abs(sample))
    }
    return peak
  }

  private func pushBuffer(
    data: UnsafeMutableRawPointer,
    byteCount: Int,
    frames: Int
  ) {
    visitSamples(data: data, byteCount: byteCount, frames: frames) { sample in
      push(sample)
    }
  }

  private func visitSamples(
    data: UnsafeMutableRawPointer,
    byteCount: Int,
    frames: Int,
    body: (Float) -> Void
  ) {
    if isFloat && bits == 32 {
      let samples = data.assumingMemoryBound(to: Float.self)
      if nonInterleaved {
        let count = min(frames, byteCount / MemoryLayout<Float>.size)
        for i in 0..<count { body(samples[i]) }
      } else {
        let stride = channels
        let available = byteCount / MemoryLayout<Float>.size
        let count = min(frames, available / max(stride, 1))
        for i in 0..<count {
          var sum: Float = 0
          for c in 0..<stride { sum += samples[i * stride + c] }
          body(sum / Float(stride))
        }
      }
    } else if bits == 16 {
      let samples = data.assumingMemoryBound(to: Int16.self)
      let stride = nonInterleaved ? 1 : channels
      let available = byteCount / MemoryLayout<Int16>.size
      let count = min(frames, available / max(stride, 1))
      for i in 0..<count {
        var sum: Float = 0
        for c in 0..<stride {
          sum += Float(samples[i * stride + c]) / 32768
        }
        body(sum / Float(stride))
      }
    }
  }

  private func push(_ sample: Float) {
    ring[ringCount] = sample
    ringCount += 1
    if ringCount >= fftSize {
      ringCount = 0
      renderSpectrum()
    }
  }

  private func renderSpectrum() {
    guard let fftSetup else { return }
    ring.withUnsafeBufferPointer { ringBuffer in
      window.withUnsafeBufferPointer { windowBuffer in
        timeDomain.withUnsafeMutableBufferPointer { timeBuffer in
          guard
            let ringBase = ringBuffer.baseAddress,
            let windowBase = windowBuffer.baseAddress,
            let timeBase = timeBuffer.baseAddress
          else { return }
          vDSP_vmul(ringBase, 1, windowBase, 1, timeBase, 1, vDSP_Length(fftSize))
        }
      }
    }
    realp.withUnsafeMutableBufferPointer { realBuffer in
      imagp.withUnsafeMutableBufferPointer { imagBuffer in
        guard
          let realBase = realBuffer.baseAddress,
          let imagBase = imagBuffer.baseAddress
        else { return }
        var split = DSPSplitComplex(realp: realBase, imagp: imagBase)
        timeDomain.withUnsafeMutableBufferPointer { timeBuffer in
          guard let timeBase = timeBuffer.baseAddress else { return }
          timeBase.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) { complex in
            vDSP_ctoz(complex, 2, &split, 1, vDSP_Length(fftSize / 2))
          }
        }
        vDSP_fft_zrip(fftSetup, &split, 1, log2n, FFTDirection(FFT_FORWARD))

        // zrip packs DC in real[0] and Nyquist in imag[0]. Musical bins follow.
        let binCount = 127
        for i in 0..<packetSize { scratch[i] = 0 }
        for k in 0..<binCount {
          let src = 1 + (k * (fftSize / 4)) / binCount
          let index = min(src, (fftSize / 2) - 1)
          let mag = hypot(realBuffer[index], imagBuffer[index]) / 24
          let clamped = min(1, mag)
          let byte = UInt8(Int((clamped * 127).rounded()))
          scratch[2 + 2 * k] = byte
          scratch[3 + 2 * k] = byte
        }
        stateLock.lock()
        for i in 0..<packetSize { packet[i] = scratch[i] }
        hasNewPacket = true
        stateLock.unlock()
      }
    }
  }
}

extension PlaybackVisualizer: FlutterStreamHandler {
  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    eventSink = events
    startTimer()
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    eventSink = nil
    return nil
  }
}

private func tapInit(
  tap: MTAudioProcessingTap,
  clientInfo: UnsafeMutableRawPointer?,
  storageOut: UnsafeMutablePointer<UnsafeMutableRawPointer?>
) {
  storageOut.pointee = clientInfo
}

private func tapFinalize(tap: MTAudioProcessingTap) {}

private func tapPrepare(
  tap: MTAudioProcessingTap,
  maxFrames: CMItemCount,
  processingFormat: UnsafePointer<AudioStreamBasicDescription>
) {
  let storage = MTAudioProcessingTapGetStorage(tap)
  let viz = Unmanaged<PlaybackVisualizer>.fromOpaque(storage).takeUnretainedValue()
  viz.prepare(processingFormat.pointee)
}

private func tapUnprepare(tap: MTAudioProcessingTap) {}

private func tapProcess(
  tap: MTAudioProcessingTap,
  numberFrames: CMItemCount,
  flags: MTAudioProcessingTapFlags,
  bufferListInOut: UnsafeMutablePointer<AudioBufferList>,
  numberFramesOut: UnsafeMutablePointer<CMItemCount>,
  flagsOut: UnsafeMutablePointer<MTAudioProcessingTapFlags>
) {
  let status = MTAudioProcessingTapGetSourceAudio(
    tap,
    numberFrames,
    bufferListInOut,
    flagsOut,
    nil,
    numberFramesOut
  )
  guard status == noErr else { return }
  let storage = MTAudioProcessingTapGetStorage(tap)
  let viz = Unmanaged<PlaybackVisualizer>.fromOpaque(storage).takeUnretainedValue()
  viz.analyze(bufferListInOut, frames: Int(numberFramesOut.pointee))
}

extension AVPlayer {
  @objc func nx_visualizer_currentItem() -> AVPlayerItem? {
    let item = nx_visualizer_currentItem()
    if let item {
      PlaybackVisualizer.shared.note(item)
    }
    return item
  }
}
