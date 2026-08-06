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
    await _playCurrent();
    _notify();
  }

  Future<void> skipPrevious() async {
    if (_queue.isEmpty || _index <= 0) return;
    _index -= 1;
    await _playCurrent();
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

  Future<void> _playCurrent() async {
    final item = current;
    if (item == null) return;
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
    await _audio.loadSource(source);
    await _audio.player.play();
  }

  void _ensureEndListener() {
    _endSub ??= _audio.player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        unawaited(skipNext());
      }
    });
  }

  void dispose() {
    _endSub?.cancel();
    _endSub = null;
  }
}
