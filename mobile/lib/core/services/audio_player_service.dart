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
}
