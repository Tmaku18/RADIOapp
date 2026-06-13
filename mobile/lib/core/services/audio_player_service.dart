import 'package:audio_session/audio_session.dart';
import 'package:just_audio/just_audio.dart';

/// App-wide single audio session. Used by [PlayerScreen] (radio), [MiniPlayerBar],
/// and artist profile playback so that playback persists across tabs and only one
/// source (radio vs discography preview) plays at a time.
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  AudioPlayer? _player;
  static bool _sessionConfigured = false;

  AudioPlayer get player {
    _player ??= AudioPlayer();
    return _player!;
  }

  /// Configure Android/iOS audio routing before any [AudioPlayer] is created.
  static Future<void> ensureInitialized() async {
    if (_sessionConfigured) return;
    final session = await AudioSession.instance;
    await session.configure(const AudioSessionConfiguration.music());
    _sessionConfigured = true;
  }
}
