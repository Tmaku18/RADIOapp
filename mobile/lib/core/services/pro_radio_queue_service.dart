import 'dart:async';
import 'dart:math';

import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

import '../models/pro_radio_models.dart';
import 'audio_player_service.dart';
import 'songs_service.dart';

/// Spotify-like on-demand queue for Pro-Radio (separate from live radio sync).
class ProRadioQueueService {
  ProRadioQueueService._();
  static final ProRadioQueueService instance = ProRadioQueueService._();

  final SongsService _songs = SongsService();
  final AudioPlayerService _audio = AudioPlayerService();

  final List<ProRadioQueueItem> _queue = [];
  int _index = -1;
  bool _shuffle = false;
  bool _repeat = false;
  StreamSubscription<PlayerState>? _endSub;
  /// Bumped on every play request so a load queued behind another one (rapid
  /// skips) is dropped instead of landing after the track the user settled on.
  int _playGeneration = 0;
  final _changes = StreamController<void>.broadcast();

  Stream<void> get changes => _changes.stream;
  List<ProRadioQueueItem> get queue => List.unmodifiable(_queue);
  int get currentIndex => _index;
  ProRadioQueueItem? get current =>
      (_index >= 0 && _index < _queue.length) ? _queue[_index] : null;
  bool get shuffle => _shuffle;
  bool get repeat => _repeat;
  bool get canSkipNext => _queue.isNotEmpty && (_repeat || _index < _queue.length - 1);
  bool get canSkipPrevious => _queue.isNotEmpty && _index > 0;

  void _notify() {
    if (!_changes.isClosed) _changes.add(null);
  }

  Future<void> playSong({
    required String songId,
    required String title,
    String? artistName,
    String? artworkUrl,
    String? knownStreamUrl,
  }) async {
    final url = knownStreamUrl?.trim().isNotEmpty == true
        ? knownStreamUrl!.trim()
        : await _songs.getStreamUrl(songId);
    if (url == null || url.isEmpty) {
      throw Exception('Could not load stream for this song.');
    }
    final item = ProRadioQueueItem(
      songId: songId,
      title: title,
      artistName: artistName,
      artworkUrl: artworkUrl,
      audioUrl: url,
    );
    _queue
      ..clear()
      ..add(item);
    _index = 0;
    await _playCurrent();
    _ensureEndListener();
    _notify();
  }

  Future<void> playItems(List<ProRadioQueueItem> items, {int startAt = 0}) async {
    if (items.isEmpty) return;
    _queue
      ..clear()
      ..addAll(items);
    _index = startAt.clamp(0, _queue.length - 1);
    // Publish the new queue before awaiting the load so the player UI shows the
    // track immediately instead of after the first buffer.
    _notify();
    await _playCurrent();
    _ensureEndListener();
    _notify();
  }

  Future<void> addToQueue(ProRadioQueueItem item) async {
    _queue.add(item);
    if (_index < 0) {
      _index = 0;
      await _playCurrent();
      _ensureEndListener();
    }
    _notify();
  }

  Future<void> playNext(ProRadioQueueItem item) async {
    if (_queue.isEmpty || _index < 0) {
      await playItems([item]);
      return;
    }
    _queue.insert(_index + 1, item);
    _notify();
  }

  Future<void> skipNext() async {
    if (_queue.isEmpty) return;
    if (_index >= _queue.length - 1) {
      if (_repeat) {
        _index = 0;
      } else {
        return;
      }
    } else {
      _index += 1;
    }
    _notify();
    await _playCurrent();
    _notify();
  }

  Future<void> skipPrevious() async {
    if (_queue.isEmpty || _index <= 0) return;
    _index -= 1;
    _notify();
    await _playCurrent();
    _notify();
  }

  /// Real pause for on-demand playback. The handler's own pause is the radio's
  /// soft mute (keeps the live stream advancing silently), which would let a
  /// playlist track run on while the listener thinks it is stopped.
  Future<void> togglePlayPause() async {
    // Radio (or another feature) took the player over while the queue stayed
    // loaded — hitting play here should bring the listener's track back rather
    // than resume whatever is on air.
    if (!ownsPlayer) {
      await _playCurrent();
      _ensureEndListener();
      _notify();
      return;
    }
    final handler = AudioPlayerService.handler;
    if (_audio.player.playing) {
      await _audio.player.pause();
      return;
    }
    await handler.setUserPaused(false);
    await handler.applyOutputVolume();
    await _audio.player.play();
  }

  Future<void> seek(Duration position) async {
    if (!ownsPlayer) return;
    await _audio.player.seek(position);
  }

  /// Jump straight to [index] in the current queue.
  Future<void> playAt(int index) async {
    if (index < 0 || index >= _queue.length) return;
    _index = index;
    _notify();
    await _playCurrent();
    _ensureEndListener();
    _notify();
  }

  void toggleShuffle() {
    _shuffle = !_shuffle;
    if (_shuffle && _queue.length > 1) {
      final playing = this.current;
      final rest = _queue.where((e) => e.songId != playing?.songId).toList()
        ..shuffle(Random());
      _queue
        ..clear()
        ..addAll([
          if (playing != null) playing,
          ...rest,
        ]);
      _index = 0;
    }
    _notify();
  }

  void toggleRepeat() {
    _repeat = !_repeat;
    _notify();
  }

  void removeAt(int index) {
    if (index < 0 || index >= _queue.length) return;
    _queue.removeAt(index);
    if (_queue.isEmpty) {
      _index = -1;
    } else if (index < _index) {
      _index -= 1;
    } else if (index == _index) {
      _index = _index.clamp(0, _queue.length - 1);
      unawaited(_playCurrent());
    }
    _notify();
  }

  /// True while the shared player is on a Pro-Radio track. Radio, Discover and
  /// artist previews all run through the same player, so queue automation must
  /// stand down when one of them owns it.
  bool get ownsPlayer {
    final tag = _audio.player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    return tag.extras?['source'] == 'pro_radio';
  }

  Future<void> _playCurrent() async {
    final item = current;
    if (item == null) return;
    final generation = ++_playGeneration;
    final handler = AudioPlayerService.handler;

    // Live radio hands the player over in one of two silent states: "paused" is
    // a soft mute (the stream keeps running at volume 0) and a DJ talk-over
    // ducks the music. Either one would start this track inaudible.
    await handler.stopVoiceOverlay();

    final source = AudioSource.uri(
      Uri.parse(item.audioUrl),
      tag: MediaItem(
        id: item.songId,
        title: item.title,
        artist: item.artistName,
        artUri: item.artworkUrl != null ? Uri.tryParse(item.artworkUrl!) : null,
        extras: const {'source': 'pro_radio'},
      ),
    );
    final applied = await _audio.loadSource(
      source,
      isStale: () => generation != _playGeneration,
    );
    if (!applied || generation != _playGeneration) return;

    // A rate nudge left over from the radio's live catch-up must not carry into
    // on-demand playback.
    if (_audio.player.speed != 1.0) await _audio.player.setSpeed(1.0);
    await handler.setUserPaused(false);
    await handler.applyOutputVolume();
    await _audio.player.play();
  }

  void _ensureEndListener() {
    _endSub ??= _audio.player.playerStateStream.listen((state) {
      if (state.processingState != ProcessingState.completed) return;
      // Radio songs complete on this same player. Advancing the Pro-Radio queue
      // there would drop a playlist track into the middle of live radio.
      if (!ownsPlayer) return;
      unawaited(skipNext());
    });
  }

  void dispose() {
    _endSub?.cancel();
    _endSub = null;
  }
}
