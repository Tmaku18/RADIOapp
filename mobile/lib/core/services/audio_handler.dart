import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

/// App-wide audio handler that owns two [AudioPlayer]s so the live DJ voice
/// can be layered on top of the radio music:
///
///  * [music] is the primary/content player (radio, discography previews,
///    Discover clips, Refinery, etc.). It drives the lock-screen notification.
///  * [voice] plays the DJ talk-over (HLS) concurrently while [music] is ducked.
///
/// We intentionally do NOT use `just_audio_background` because it replaces
/// just_audio's platform interface with a single-player implementation, which
/// makes a second simultaneous player impossible. A custom [BaseAudioHandler]
/// lets us run two plain just_audio players that mix through the OS audio mixer
/// on both Android and iOS, while we re-broadcast the music player's state and
/// metadata to `audio_service` for the lock screen / media notification.
class NetworxAudioHandler extends BaseAudioHandler with SeekHandler {
  NetworxAudioHandler() {
    // Guarantee a known full-volume baseline for the radio music. Without this
    // the music could be perceived as quiet (notably quieter than web).
    music.setVolume(1.0);
    _wireMusicToNotification();
    _wireVoiceAutoRestore();
  }

  /// Primary content player (radio + previews). Exposed via
  /// `AudioPlayerService().player` so existing screens keep working unchanged.
  ///
  /// A generous buffer is configured so transient CPU/network stalls don't
  /// starve the audio sink (heard as glitches / cut-outs). ExoPlayer keeps up
  /// to a minute buffered and requires several seconds before resuming after a
  /// rebuffer, which smooths over momentary hiccups.
  final AudioPlayer music = AudioPlayer(
    audioLoadConfiguration: const AudioLoadConfiguration(
      androidLoadControl: AndroidLoadControl(
        minBufferDuration: Duration(seconds: 30),
        maxBufferDuration: Duration(seconds: 60),
        bufferForPlaybackDuration: Duration(seconds: 5),
        bufferForPlaybackAfterRebufferDuration: Duration(seconds: 10),
        prioritizeTimeOverSizeThresholds: true,
      ),
      darwinLoadControl: DarwinLoadControl(
        preferredForwardBufferDuration: Duration(seconds: 30),
      ),
    ),
  );

  /// Secondary player used only for the DJ voice-over overlay.
  final AudioPlayer voice = AudioPlayer();

  /// User-facing music volume (0..1) to restore to after a DJ talk-over ends.
  double _baseMusicVolume = 1.0;

  bool _overlayActive = false;
  String? _overlayUrl;
  double _overlayDuckVolume = 0.25;

  /// Mirror the music player's state + current [MediaItem] into `audio_service`
  /// so the system media notification shows track info and play/pause works.
  void _wireMusicToNotification() {
    music.playbackEventStream.listen(
      _broadcastMusicState,
      onError: (Object _, StackTrace _) {
        // Keep the notification responsive even if the stream errors.
      },
    );
    music.durationStream.listen((duration) {
      final current = mediaItem.valueOrNull;
      if (current != null && duration != null) {
        mediaItem.add(current.copyWith(duration: duration));
      }
    });
    music.sequenceStateStream.listen((state) {
      final source = state?.currentSource;
      final tag = source?.tag;
      if (tag is MediaItem) {
        final duration = music.duration;
        mediaItem.add(
          duration != null ? tag.copyWith(duration: duration) : tag,
        );
      }
    });
  }

  /// Safety net: if the DJ voice player stops, completes, or errors out (e.g. a
  /// missed `mic_off`, the live HLS ending, or a network drop), make sure the
  /// music is restored to the user's base volume. Otherwise a ducked overlay
  /// that is no longer audible would leave the radio stuck playing quietly.
  void _wireVoiceAutoRestore() {
    voice.playerStateStream.listen((state) {
      final hasStopped = !state.playing &&
          (state.processingState == ProcessingState.idle ||
              state.processingState == ProcessingState.completed);
      if (hasStopped && _overlayActive) {
        _overlayActive = false;
        _overlayUrl = null;
        music.setVolume(_baseMusicVolume);
      }
    }, onError: (Object _, StackTrace _) {
      if (_overlayActive) {
        _overlayActive = false;
        _overlayUrl = null;
        music.setVolume(_baseMusicVolume);
      }
    });
  }

  void _broadcastMusicState(PlaybackEvent event) {
    final playing = music.playing;
    playbackState.add(
      playbackState.value.copyWith(
        controls: [
          if (playing) MediaControl.pause else MediaControl.play,
          MediaControl.stop,
        ],
        systemActions: const {
          MediaAction.seek,
          MediaAction.seekForward,
          MediaAction.seekBackward,
        },
        androidCompactActionIndices: const [0],
        processingState: _mapProcessingState(music.processingState),
        playing: playing,
        updatePosition: music.position,
        bufferedPosition: music.bufferedPosition,
        speed: music.speed,
        queueIndex: event.currentIndex,
      ),
    );
  }

  AudioProcessingState _mapProcessingState(ProcessingState state) {
    switch (state) {
      case ProcessingState.idle:
        return AudioProcessingState.idle;
      case ProcessingState.loading:
        return AudioProcessingState.loading;
      case ProcessingState.buffering:
        return AudioProcessingState.buffering;
      case ProcessingState.ready:
        return AudioProcessingState.ready;
      case ProcessingState.completed:
        return AudioProcessingState.completed;
    }
  }

  // --- Media notification controls delegate to the music player ---

  @override
  Future<void> play() => music.play();

  @override
  Future<void> pause() => music.pause();

  @override
  Future<void> seek(Duration position) => music.seek(position);

  @override
  Future<void> stop() async {
    await stopVoiceOverlay();
    await music.stop();
    await super.stop();
  }

  // --- DJ voice-over overlay API ---

  /// Remember the user's chosen music volume so we can restore it when a DJ
  /// talk-over finishes. If an overlay is active we keep the ducked level and
  /// only update the stored base.
  Future<void> setBaseMusicVolume(double volume) async {
    _baseMusicVolume = volume.clamp(0.0, 1.0);
    if (!_overlayActive) {
      await music.setVolume(_baseMusicVolume);
    }
  }

  /// Duck the music and start playing the DJ voice [url] (typically an HLS
  /// stream) layered on top. Safe to call repeatedly; restarts only when the
  /// source URL changes.
  Future<void> startVoiceOverlay(
    String url, {
    double duckVolume = 0.25,
  }) async {
    final duck = duckVolume.clamp(0.0, 1.0);
    _overlayDuckVolume = duck;

    // Already streaming this talk-over: just (re)apply the duck level.
    if (_overlayUrl == url && voice.playing) {
      _overlayActive = true;
      await music.setVolume(duck);
      return;
    }

    _overlayUrl = url;
    try {
      await voice.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await voice.setVolume(1.0);
      // Duck the music only once the live stream actually loads. A live HLS
      // manifest can 404 during Cloudflare warm-up; ducking before it is ready
      // would leave listeners with quiet music and no voice. The periodic radio
      // sync (and realtime mic_on) retry until the stream is up.
      await music.setVolume(duck);
      _overlayActive = true;
      await voice.play();
    } catch (_) {
      // Stream not ready yet: clear state so the next attempt retries cleanly
      // and keep the music at full volume in the meantime.
      _overlayUrl = null;
      _overlayActive = false;
      await music.setVolume(_baseMusicVolume);
    }
  }

  /// Adjust the duck level while a talk-over is live (admin moved the slider).
  Future<void> setDuckVolume(double duckVolume) async {
    _overlayDuckVolume = duckVolume.clamp(0.0, 1.0);
    if (_overlayActive) {
      await music.setVolume(_overlayDuckVolume);
    }
  }

  /// Stop the DJ voice-over and restore the music to the user's base volume.
  Future<void> stopVoiceOverlay() async {
    _overlayActive = false;
    _overlayUrl = null;
    try {
      await voice.stop();
    } catch (_) {
      // Ignore stop failures on an already-idle overlay player.
    }
    await music.setVolume(_baseMusicVolume);
  }

  Future<void> dispose() async {
    await voice.dispose();
    await music.dispose();
  }
}
