import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';

import 'audio_handler.dart';

/// App-wide audio entry point. Used by [PlayerScreen] (radio), [MiniPlayerBar],
/// artist profile playback, Discover, and Refinery so that playback persists
/// across tabs and only one music source plays at a time.
///
/// Backed by a single [NetworxAudioHandler] which owns the primary `music`
/// player (exposed here as [player]) plus a separate `voice` player for DJ
/// talk-overs. Screens that only need the music player keep using
/// `AudioPlayerService().player`; the DJ overlay is driven via
/// [AudioPlayerService.handler].
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  static NetworxAudioHandler? _handler;
  static bool _initialized = false;
  static Completer<void>? _sourceLoadGate;

  /// The primary content player (radio + previews).
  AudioPlayer get player => handler.music;

  /// The shared audio handler (use for DJ voice-over overlays).
  static NetworxAudioHandler get handler {
    final h = _handler;
    if (h == null) {
      throw StateError(
        'AudioPlayerService.ensureInitialized() must be awaited before use.',
      );
    }
    return h;
  }

  /// Serialize `setAudioSource` calls on the shared player so concurrent loads
  /// (e.g. radio startup vs Discover autoplay) don't throw "Loading interrupted".
  Future<void> loadSource(
    AudioSource source, {
    Duration? initialPosition,
  }) async {
    await _runExclusiveSourceLoad(() async {
      await player.setAudioSource(source);
      if (initialPosition != null && initialPosition > Duration.zero) {
        await player.seek(initialPosition);
      }
    });
  }

  static Future<void> _runExclusiveSourceLoad(
    Future<void> Function() load,
  ) async {
    while (_sourceLoadGate != null) {
      final gate = _sourceLoadGate!;
      try {
        await gate.future;
      } catch (_) {}
    }

    final gate = Completer<void>();
    _sourceLoadGate = gate;
    try {
      await load();
    } finally {
      if (!gate.isCompleted) gate.complete();
      if (identical(_sourceLoadGate, gate)) {
        _sourceLoadGate = null;
      }
    }
  }

  /// Configure the audio session and stand up the background audio handler.
  /// Must be awaited during app startup before any playback.
  static Future<void> ensureInitialized() async {
    if (_initialized) return;
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());

    _handler = await AudioService.init(
      builder: () => NetworxAudioHandler(),
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'networx_radio_playback',
        androidNotificationChannelName: 'NETWORX Radio Playback',
        androidNotificationOngoing: true,
      ),
    );
    _initialized = true;
  }

  /// Switch to playAndRecord before WebRTC getUserMedia so iOS grants mic/cam
  /// instead of hanging on a music-only session held by the radio player.
  static Future<void> prepareForBroadcast() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(
        AudioSessionConfiguration(
          avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
          avAudioSessionCategoryOptions:
              AVAudioSessionCategoryOptions.allowBluetooth |
                  AVAudioSessionCategoryOptions.defaultToSpeaker |
                  AVAudioSessionCategoryOptions.mixWithOthers,
          avAudioSessionMode: AVAudioSessionMode.videoChat,
          androidAudioAttributes: const AndroidAudioAttributes(
            contentType: AndroidAudioContentType.speech,
            usage: AndroidAudioUsage.voiceCommunication,
          ),
          androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
          androidWillPauseWhenDucked: false,
        ),
      );
      await session.setActive(true);
    } catch (_) {}
  }

  /// Restore the standard music session after camera/mic (`playAndRecord`) use
  /// so radio output returns to a normal route/gain instead of staying ducked.
  static Future<void> restoreMusicSession() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(const AudioSessionConfiguration.music());
      await session.setActive(true);
    } catch (_) {}
    try {
      await handler.applyOutputVolume();
    } catch (_) {}
  }
}
