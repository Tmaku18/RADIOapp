import 'package:just_audio/just_audio.dart';

/// App-wide single audio session. Used by [PlayerScreen] (radio), [MiniPlayerBar],
/// and artist profile playback so that playback persists across tabs and only one
/// source (radio vs discography preview) plays at a time.
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer player = AudioPlayer();
}

