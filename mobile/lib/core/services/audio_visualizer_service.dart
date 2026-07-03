import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'audio_player_service.dart';

/// Taps the app's own audio output on Android (android.media.audiofx.Visualizer
/// via a platform channel in MainActivity) and turns the raw FFT into smoothed
/// 0..1 bar heights — the same processing the web player applies to its
/// AnalyserNode data (log-ish bin reduction + treble tilt + gamma punch +
/// attack/release smoothing).
///
/// When real data is unavailable (iOS, permission denied, Visualizer failure,
/// or sustained silence from a dead tap) [bars] is null and the visualizer
/// widgets fall back to their existing simulated animation.
class AudioVisualizerService {
  AudioVisualizerService._();
  static final AudioVisualizerService _instance = AudioVisualizerService._();
  factory AudioVisualizerService() => _instance;

  static const int barCount = 24;
  static const _method = MethodChannel('networx/visualizer');
  static const _events = EventChannel('networx/visualizer/fft');
  static const _deniedPrefKey = 'visualizer_mic_permission_denied';

  /// Latest real bar heights (0..1, [barCount] values), or null when real FFT
  /// is unavailable and widgets should simulate.
  final ValueNotifier<Float32List?> bars = ValueNotifier<Float32List?>(null);

  StreamSubscription<int?>? _sessionSub;
  StreamSubscription<dynamic>? _fftSub;
  Float32List _smoothed = Float32List(barCount);
  int _attachedSessionId = -1;
  bool _started = false;
  int _zeroFrames = 0;
  DateTime _lastFrameAt = DateTime.fromMillisecondsSinceEpoch(0);

  /// Consecutive all-zero FFT frames (~20-30/s) before treating the tap as dead
  /// and falling back to simulation — mirrors the web player's dead-tap check.
  static const int _maxZeroFrames = 90;

  /// Bars only if a real frame arrived recently; guards against a stalled
  /// native stream leaving frozen heights on screen.
  Float32List? get freshBars {
    final value = bars.value;
    if (value == null) return null;
    if (DateTime.now().difference(_lastFrameAt).inMilliseconds > 1000) {
      return null;
    }
    return value;
  }

  /// Ask for the RECORD_AUDIO permission (required by Android's Visualizer even
  /// though it only captures this app's output) and start following the music
  /// player's audio session. Safe to call repeatedly.
  ///
  /// A previous "deny" is remembered and never re-prompted; we still re-check
  /// silently in case the user granted the permission from system settings.
  Future<bool> ensureStarted() async {
    if (!Platform.isAndroid) return false;
    if (_started) return true;

    try {
      var granted = await _method.invokeMethod<bool>('hasPermission') ?? false;
      if (!granted) {
        final prefs = await SharedPreferences.getInstance();
        if (prefs.getBool(_deniedPrefKey) ?? false) return false;
        granted =
            await _method.invokeMethod<bool>('requestPermission') ?? false;
        if (!granted) {
          await prefs.setBool(_deniedPrefKey, true);
          return false;
        }
      }
    } on PlatformException {
      return false;
    }

    _started = true;
    _listenToFft();
    _followAudioSession();
    return true;
  }

  void _followAudioSession() {
    _sessionSub?.cancel();
    final player = AudioPlayerService().player;
    _sessionSub = player.androidAudioSessionIdStream.listen((sessionId) {
      if (sessionId == null || sessionId < 0) return;
      _attach(sessionId);
    });
    final current = player.androidAudioSessionId;
    if (current != null && current >= 0) {
      _attach(current);
    }
  }

  Future<void> _attach(int sessionId) async {
    if (sessionId == _attachedSessionId && bars.value != null) return;
    try {
      final ok = await _method.invokeMethod<bool>('attach', {
        'sessionId': sessionId,
      });
      if (ok == true) {
        _attachedSessionId = sessionId;
        _zeroFrames = 0;
      } else {
        bars.value = null;
      }
    } on PlatformException {
      bars.value = null;
    }
  }

  void _listenToFft() {
    _fftSub?.cancel();
    _fftSub = _events.receiveBroadcastStream().listen(
      (dynamic data) {
        if (data is! Uint8List && data is! List) return;
        final fft = data is Uint8List
            ? data
            : Uint8List.fromList((data as List).cast<int>());
        _processFft(fft);
      },
      onError: (Object _) {
        bars.value = null;
      },
    );
  }

  /// Android Visualizer FFT layout: [Re(0), Re(N/2), Re(1), Im(1), Re(2),
  /// Im(2), ...] as signed bytes. Convert to magnitudes, reduce to [barCount]
  /// bars with the web's log-ish curve, apply tilt + gamma, then smooth with
  /// fast attack / slower release.
  void _processFft(Uint8List fft) {
    final n = fft.length;
    if (n < 4) return;
    final binCount = n ~/ 2 - 1;
    if (binCount <= 0) return;

    // Magnitudes normalized to 0..1 (max |re|,|im| is 128).
    final mags = Float32List(binCount);
    var peak = 0.0;
    for (var k = 0; k < binCount; k++) {
      final re = fft[2 + 2 * k].toSigned(8).toDouble();
      final im = fft[3 + 2 * k].toSigned(8).toDouble();
      final mag = math.sqrt(re * re + im * im) / 181.02; // 128 * sqrt(2)
      mags[k] = mag > 1 ? 1 : mag;
      if (mag > peak) peak = mag;
    }

    // Dead-tap detection: sustained silence while we believe we're attached.
    if (peak <= 0.001) {
      _zeroFrames++;
      if (_zeroFrames >= _maxZeroFrames) {
        bars.value = null;
        return;
      }
    } else {
      _zeroFrames = 0;
    }

    final target = Float32List(barCount);
    for (var i = 0; i < barCount; i++) {
      final t0 = i / barCount;
      final t1 = (i + 1) / barCount;
      final s = (math.pow(t0, 1.6) * binCount).floor();
      final e = math.max(s + 1, (math.pow(t1, 1.6) * binCount).floor());
      var sum = 0.0;
      var count = 0;
      for (var j = s; j < e && j < binCount; j++) {
        sum += mags[j];
        count++;
      }
      var v = count > 0 ? sum / count : 0.0;

      // Web dramatizeBars: treble tilt + gamma < 1 for punch with headroom.
      final frac = i / barCount;
      v = v * (1 + 0.9 * math.pow(frac, 1.3));
      v = math.pow(v.clamp(0.0, 1.0), 0.72).toDouble();
      target[i] = v;
    }

    // Fast attack, slower release (web updateBassRef-style smoothing per bar).
    final next = Float32List(barCount);
    for (var i = 0; i < barCount; i++) {
      final prev = _smoothed[i];
      final t = target[i];
      final alpha = t > prev ? 0.55 : 0.30;
      next[i] = prev * (1 - alpha) + t * alpha;
    }
    _smoothed = next;
    _lastFrameAt = DateTime.now();
    bars.value = next;
  }

  Future<void> stop() async {
    _sessionSub?.cancel();
    _sessionSub = null;
    _fftSub?.cancel();
    _fftSub = null;
    _started = false;
    _attachedSessionId = -1;
    bars.value = null;
    if (Platform.isAndroid) {
      try {
        await _method.invokeMethod<void>('detach');
      } on PlatformException {
        // Native side already detached.
      }
    }
  }
}
