import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:audio_service/audio_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/models/discover_audio_models.dart';
import '../../core/services/discover_audio_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/networx_extensions.dart';

class DiscoverAudioTab extends StatefulWidget {
  const DiscoverAudioTab({super.key});

  @override
  State<DiscoverAudioTab> createState() => _DiscoverAudioTabState();
}

class _DiscoverAudioTabState extends State<DiscoverAudioTab> {
  static const int _pageSize = 12;
  static const String _selectedStationPrefKey = 'selected_radio_station_id';
  static const String _defaultStationId = 'us-rap';
  final DiscoverAudioService _service = DiscoverAudioService();
  final AudioPlayer _player = AudioPlayerService().player;
  StreamSubscription<PlayerState>? _playerStateSub;

  bool _loading = true;
  bool _loadingMore = false;
  bool _busySwipe = false;
  String? _error;
  String? _nextCursor;
  List<DiscoverAudioSongCard> _cards = const [];
  int _shownAtMs = DateTime.now().millisecondsSinceEpoch;
  Timer? _clipStopTimer;
  String _stationId = _defaultStationId;
  String _seed =
      '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 30)}';
  bool _clipIsPlaying = false;

  DiscoverAudioSongCard? get _currentCard =>
      _cards.isEmpty ? null : _cards.first;

  @override
  void initState() {
    super.initState();
    _playerStateSub = _player.playerStateStream.listen((playerState) {
      if (!mounted) return;
      setState(() => _clipIsPlaying = playerState.playing);
    });
    _loadPage(append: false);
  }

  @override
  void dispose() {
    _clipStopTimer?.cancel();
    _playerStateSub?.cancel();
    // Keep the shared player alive globally, but stop discover clip playback
    // when leaving this tab.
    _player.stop();
    super.dispose();
  }

  String _clipMediaId(DiscoverAudioSongCard card) => 'discover:${card.songId}';

  bool _isCurrentClipLoaded(DiscoverAudioSongCard card) {
    final currentTag = _player.sequenceState?.currentSource?.tag;
    if (currentTag is MediaItem) {
      return currentTag.id == _clipMediaId(card);
    }
    return false;
  }

  void _startClipStopTimer(DiscoverAudioSongCard card) {
    _clipStopTimer?.cancel();
    final capSeconds = card.clipDurationSeconds.clamp(1, 15).toDouble();
    _clipStopTimer = Timer(
      Duration(milliseconds: (capSeconds * 1000).toInt()),
      () async {
        try {
          await _player.pause();
          await _player.seek(Duration.zero);
        } catch (_) {}
      },
    );
  }

  Future<String> _resolveStationId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final stored = prefs.getString(_selectedStationPrefKey)?.trim();
      if (stored != null && stored.isNotEmpty) return stored;
    } catch (_) {
      // Keep fallback if prefs is unavailable.
    }
    return _defaultStationId;
  }

  Future<void> _loadPage({required bool append}) async {
    if (!append) {
      _stationId = await _resolveStationId();
    }
    if (!append) {
      // New seed on refresh gives a new random order.
      _seed =
          '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 30)}';
    }
    if (append) {
      setState(() => _loadingMore = true);
    } else {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final page = await _service.getFeed(
        limit: _pageSize,
        cursor: append ? _nextCursor : null,
        seed: _seed,
        stationId: _stationId,
      );
      if (!mounted) return;
      setState(() {
        _cards = append ? [..._cards, ...page.items] : page.items;
        _nextCursor = page.nextCursor;
      });
      if (!append) {
        _shownAtMs = DateTime.now().millisecondsSinceEpoch;
        await _autoplayCurrent();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _autoplayCurrent() async {
    _clipStopTimer?.cancel();
    final card = _currentCard;
    if (card == null || card.clipUrl.isEmpty) {
      await _player.stop();
      return;
    }

    await _player.setAudioSource(
      AudioSource.uri(
        Uri.parse(card.clipUrl),
        tag: MediaItem(
          id: _clipMediaId(card),
          title: card.title,
          artist: card.artistDisplayName ?? card.artistName,
          artUri: (card.backgroundUrl != null && card.backgroundUrl!.isNotEmpty)
              ? Uri.tryParse(card.backgroundUrl!)
              : null,
        ),
      ),
    );
    await _player.seek(Duration.zero);
    unawaited(_player.play());
    _startClipStopTimer(card);
  }

  Future<void> _toggleCurrentClipPlayback() async {
    final card = _currentCard;
    if (card == null || card.clipUrl.isEmpty) return;

    if (_clipIsPlaying) {
      _clipStopTimer?.cancel();
      await _player.pause();
      return;
    }

    if (!_isCurrentClipLoaded(card)) {
      await _autoplayCurrent();
      return;
    }

    unawaited(_player.play());
    _startClipStopTimer(card);
  }

  Future<void> _applySwipe(String direction) async {
    final card = _currentCard;
    if (card == null || _busySwipe) return;

    setState(() => _busySwipe = true);
    final decisionMs = DateTime.now().millisecondsSinceEpoch - _shownAtMs;
    try {
      await _service.swipe(
        songId: card.songId,
        direction: direction,
        decisionMs: decisionMs < 0 ? 0 : decisionMs,
        stationId: _stationId,
      );
      if (!mounted) return;
      setState(() {
        _cards = _cards.skip(1).toList();
        _shownAtMs = DateTime.now().millisecondsSinceEpoch;
      });
      await _autoplayCurrent();
      if (_cards.length < 3 && _nextCursor != null) {
        unawaited(_loadPage(append: true));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busySwipe = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final card = _currentCard;

    if (_loading && card == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (card == null) {
      return RefreshIndicator(
        onRefresh: () => _loadPage(append: false),
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Text(
                'No more clips right now.',
                style: TextStyle(color: surfaces.textSecondary),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: FilledButton(
                onPressed: () => _loadPage(append: false),
                child: const Text('Refresh'),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadPage(append: false),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          if (_error != null)
            Card(
              color: Theme.of(context).colorScheme.errorContainer,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(_error!),
              ),
            ),
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (card.backgroundUrl != null &&
                          card.backgroundUrl!.isNotEmpty)
                        Image.network(
                          card.backgroundUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              Container(
                                decoration: BoxDecoration(
                                  gradient: surfaces.signatureGradient,
                                ),
                              ),
                        )
                      else
                        Container(
                          decoration: BoxDecoration(
                            gradient: surfaces.signatureGradient,
                          ),
                        ),
                      Container(color: Colors.black.withValues(alpha: 0.35)),
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${card.clipDurationSeconds.toStringAsFixed(0)}s clip • $_stationId',
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 10,
                        right: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.5),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${card.likeCount} likes',
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 14,
                        right: 14,
                        bottom: 14,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              card.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              card.artistDisplayName ?? card.artistName,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busySwipe
                              ? null
                              : _toggleCurrentClipPlayback,
                          icon: Icon(
                            _clipIsPlaying
                                ? Icons.pause_circle_outline
                                : Icons.play_circle_outline,
                          ),
                          label: Text(
                            _clipIsPlaying ? 'Pause clip' : 'Play clip',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busySwipe
                              ? null
                              : () => _applySwipe('left_skip'),
                          icon: const Icon(Icons.keyboard_double_arrow_left),
                          label: const Text('Skip'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _busySwipe
                              ? null
                              : () => _applySwipe('right_like'),
                          icon: const Icon(Icons.favorite_outline),
                          label: const Text('Save'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_loadingMore)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }
}
