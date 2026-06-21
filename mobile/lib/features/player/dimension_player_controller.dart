import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/services/audio_player_service.dart';
import '../../core/services/radio_service.dart';

/// Flutter port of web [useDimensionPlayer.ts] — read-only mapping to bar UI.
class DimensionPlayerController extends ChangeNotifier {
  DimensionPlayerController() {
    _init();
  }

  final RadioService _radio = RadioService();
  final AudioPlayer _player = AudioPlayerService().player;
  static const _reactionKey = 'radio:reactionByVoteKey';

  StreamSubscription<PlayerState>? _playerSub;
  StreamSubscription<SequenceState?>? _seqSub;
  Timer? _tempTimer;
  VoidCallback? _pausedListener;

  String? _selectedReaction;
  bool _isVoting = false;
  int? _temperature;
  String _radioId = RadioService.defaultRadioId;

  bool get isVoting => _isVoting;
  String? get selectedReaction => _selectedReaction;
  int? get temperature => _temperature;

  MediaItem? get _media {
    final tag = _player.sequenceState.currentSource?.tag;
    return tag is MediaItem ? tag : null;
  }

  bool get hasTrack => _media != null;

  bool get isPlaying {
    final handler = AudioPlayerService.handler;
    return !handler.userPausedNotifier.value && _player.playerState.playing;
  }

  bool get showLiveBadge => hasTrack && isPlaying;

  double get progress {
    final dur = _player.duration;
    final pos = _player.position;
    if (dur == null || dur.inMilliseconds <= 0) return 0;
    return (pos.inMilliseconds / dur.inMilliseconds * 100).clamp(0, 100);
  }

  String get elapsedLabel => _formatTime(_player.position);
  String get totalLabel {
    final d = _player.duration;
    return d != null ? _formatTime(d) : '—';
  }

  bool get canVote {
    final id = _media?.id;
    return id != null && id.isNotEmpty;
  }

  bool get canSkip {
    final d = _player.duration;
    return d != null && d.inSeconds > 0;
  }

  void _onPausedChanged() => notifyListeners();

  Future<void> _init() async {
    _playerSub = _player.playerStateStream.listen((_) => notifyListeners());
    _seqSub = _player.sequenceStateStream.listen((_) {
      notifyListeners();
      _loadStoredReaction();
      unawaited(_refreshTemperature());
    });
    _pausedListener = _onPausedChanged;
    AudioPlayerService.handler.userPausedNotifier.addListener(_onPausedChanged);
    _tempTimer = Timer.periodic(const Duration(seconds: 7), (_) {
      unawaited(_refreshTemperature());
    });
    await _loadStoredReaction();
    await _refreshTemperature();
  }

  Future<void> _refreshTemperature() async {
    try {
      final res = await _radio.getCurrentTrack(radioId: _radioId);
      final track = res.track;
      if (track == null) {
        _temperature = null;
      } else {
        _temperature = track.temperaturePercent.round().clamp(0, 100);
      }
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _loadStoredReaction() async {
    final media = _media;
    if (media == null) {
      _selectedReaction = null;
      notifyListeners();
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_reactionKey);
    if (raw == null) return;
    // Simple key per song id
    _selectedReaction = prefs.getString('$_reactionKey:${media.id}');
    notifyListeners();
  }

  Future<void> togglePlay() async {
    final handler = AudioPlayerService.handler;
    if (isPlaying) {
      await handler.setUserPaused(true);
    } else {
      await handler.setUserPaused(false);
      if (!_player.playerState.playing) {
        await _player.play();
      }
    }
    notifyListeners();
  }

  Future<void> seekPrev() async {
    if (!canSkip) return;
    final pos = _player.position;
    await _player.seek(Duration(seconds: (pos.inSeconds - 10).clamp(0, 999999)));
  }

  Future<void> seekNext() async {
    if (!canSkip) return;
    final dur = _player.duration;
    if (dur == null) return;
    final pos = _player.position;
    await _player.seek(
      Duration(seconds: (pos.inSeconds + 10).clamp(0, dur.inSeconds)),
    );
  }

  Future<void> seekToProgress(double percent) async {
    if (!canSkip) return;
    final dur = _player.duration;
    if (dur == null) return;
    await _player.seek(
      Duration(milliseconds: (dur.inMilliseconds * percent / 100).round()),
    );
  }

  Future<void> setVolume(double percent) async {
    await _player.setVolume((percent / 100).clamp(0, 1));
    notifyListeners();
  }

  Future<void> submitReaction(String reaction) async {
    final media = _media;
    if (media == null || _isVoting) return;
    _isVoting = true;
    notifyListeners();
    try {
      final result = await _radio.submitReaction(
        songId: media.id,
        reaction: reaction,
      );
      final server = result?['reaction']?.toString();
      if (server == 'fire' || server == 'shit') {
        _selectedReaction = server;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('$_reactionKey:${media.id}', server!);
      }
      await _refreshTemperature();
    } finally {
      _isVoting = false;
      notifyListeners();
    }
  }

  String _formatTime(Duration d) {
    final mins = d.inMinutes;
    final secs = d.inSeconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _playerSub?.cancel();
    _seqSub?.cancel();
    if (_pausedListener != null) {
      AudioPlayerService.handler.userPausedNotifier
          .removeListener(_pausedListener!);
    }
    _tempTimer?.cancel();
    super.dispose();
  }
}

/// Singleton for app-wide dimension bar.
final dimensionPlayerController = DimensionPlayerController();
