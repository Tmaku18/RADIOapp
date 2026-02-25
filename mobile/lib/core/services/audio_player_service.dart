import 'package:just_audio/just_audio.dart';

/// Shared player instance so radio audio can persist across navigation/screens.
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer player = AudioPlayer();
}

