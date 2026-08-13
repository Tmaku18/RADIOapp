import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/models/pro_radio_models.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/pro_radio_queue_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../dimension/floating_album_scene.dart';
import '../player/widgets/synced_lyrics_panel.dart';

/// Full-screen on-demand player for Pro-Radio playlists.
///
/// Mirrors the live radio player's presentation (full-bleed cover, glass detail
/// panel, synced captions) but drives [ProRadioQueueService] instead of the live
/// timeline, so it gets the controls radio can't offer: scrubbing, previous
/// track, shuffle and repeat.
class ProRadioPlayerScreen extends StatefulWidget {
  const ProRadioPlayerScreen({super.key, this.playlistTitle});

  /// Shown above the track title so the listener knows what they are playing.
  final String? playlistTitle;

  @override
  State<ProRadioPlayerScreen> createState() => _ProRadioPlayerScreenState();
}

class _ProRadioPlayerScreenState extends State<ProRadioPlayerScreen> {
  final ProRadioQueueService _queue = ProRadioQueueService.instance;
  final AudioPlayer _audio = AudioPlayerService().player;

  StreamSubscription<void>? _queueSub;
  StreamSubscription<bool>? _playingSub;

  bool _playing = false;
  /// Position being dragged, or null when the slider follows playback.
  Duration? _scrubTo;

  @override
  void initState() {
    super.initState();
    _playing = _audio.playing;
    _queueSub = _queue.changes.listen((_) {
      if (mounted) setState(() {});
    });
    _playingSub = _audio.playingStream.listen((playing) {
      if (mounted) setState(() => _playing = playing);
    });
  }

  @override
  void dispose() {
    _queueSub?.cancel();
    _playingSub?.cancel();
    super.dispose();
  }

  Future<void> _togglePlayPause() async {
    await _queue.togglePlayPause();
  }

  Future<void> _skipNext() async {
    if (!_queue.canSkipNext) return;
    await _queue.skipNext();
  }

  Future<void> _skipPrevious() async {
    // Standard player behaviour: restart the track unless we're near the start.
    if (_audio.position > const Duration(seconds: 3)) {
      await _queue.seek(Duration.zero);
      return;
    }
    if (!_queue.canSkipPrevious) return;
    await _queue.skipPrevious();
  }

  @override
  Widget build(BuildContext context) {
    final current = _queue.current;
    final coverUrl = BrandAssets.displayArtworkUrl(current?.artworkUrl);

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          widget.playlistTitle ?? 'Pro-Radio',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 14),
        ),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Same single-background treatment as the live radio player: the
          // artwork, out of focus, under one contrast scrim.
          if (coverUrl != null) ...[
            Positioned.fill(
              child: FloatingAlbumScene(
                key: ValueKey('pro-radio-bg-$coverUrl'),
                imageUrl: coverUrl,
                fullscreen: true,
                blurSigma: 45,
              ),
            ),
            const Positioned.fill(
              child: IgnorePointer(child: _PearlescentWash()),
            ),
          ] else
            const Positioned.fill(child: CyberBackdrop()),
          Padding(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top + kToolbarHeight,
            ),
            child: current == null
                ? const _EmptyQueue()
                : _ProRadioPlayerBody(
                    item: current,
                    playlistTitle: widget.playlistTitle,
                    audio: _audio,
                    queue: _queue,
                    playing: _playing,
                    scrubTo: _scrubTo,
                    onScrubStart: (value) => setState(() => _scrubTo = value),
                    onScrubUpdate: (value) => setState(() => _scrubTo = value),
                    onScrubEnd: (value) async {
                      await _queue.seek(value);
                      if (mounted) setState(() => _scrubTo = null);
                    },
                    onPlayPause: _togglePlayPause,
                    onNext: _skipNext,
                    onPrevious: _skipPrevious,
                    onToggleShuffle: () {
                      _queue.toggleShuffle();
                      setState(() {});
                    },
                    onToggleRepeat: () {
                      _queue.toggleRepeat();
                      setState(() {});
                    },
                    onPlayAt: (index) => _queue.playAt(index),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ProRadioPlayerBody extends StatelessWidget {
  const _ProRadioPlayerBody({
    required this.item,
    required this.playlistTitle,
    required this.audio,
    required this.queue,
    required this.playing,
    required this.scrubTo,
    required this.onScrubStart,
    required this.onScrubUpdate,
    required this.onScrubEnd,
    required this.onPlayPause,
    required this.onNext,
    required this.onPrevious,
    required this.onToggleShuffle,
    required this.onToggleRepeat,
    required this.onPlayAt,
  });

  final ProRadioQueueItem item;
  final String? playlistTitle;
  final AudioPlayer audio;
  final ProRadioQueueService queue;
  final bool playing;
  final Duration? scrubTo;
  final ValueChanged<Duration> onScrubStart;
  final ValueChanged<Duration> onScrubUpdate;
  final Future<void> Function(Duration) onScrubEnd;
  final VoidCallback onPlayPause;
  final VoidCallback onNext;
  final VoidCallback onPrevious;
  final VoidCallback onToggleShuffle;
  final VoidCallback onToggleRepeat;
  final ValueChanged<int> onPlayAt;

  static String _formatMmSs(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget albumArt() {
      final artworkUrl = BrandAssets.displayArtworkUrl(item.artworkUrl);
      return AspectRatio(
        aspectRatio: 1,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            boxShadow: DimensionTokens.artworkShadow(blur: 36),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            child: artworkUrl != null
                ? FloatingAlbumScene(
                    key: ValueKey(artworkUrl),
                    imageUrl: artworkUrl,
                    floatAmplitude: 0,
                    borderRadius: BorderRadius.zero,
                  )
                : ColoredBox(
                    color: DimensionTokens.bgSurface,
                    child: Icon(
                      Icons.queue_music_rounded,
                      size: 64,
                      color: DimensionTokens.textMuted,
                    ),
                  ),
          ),
        ),
      );
    }

    // Track details sit on the scrimmed artwork rather than in a floating
    // frosted card — see the note on the live radio player.
    Widget glassPanel({required Widget child, double padding = 16}) {
      return Padding(
        padding: EdgeInsets.symmetric(horizontal: padding * 0.25),
        child: child,
      );
    }

    Widget progressBar() {
      return StreamBuilder<Duration>(
        stream: audio.positionStream,
        builder: (context, snap) {
          final duration = audio.duration ?? Duration.zero;
          final live = scrubTo ?? snap.data ?? Duration.zero;
          final maxMs = duration.inMilliseconds.toDouble();
          final valueMs = live.inMilliseconds.toDouble().clamp(
            0.0,
            maxMs <= 0 ? 0.0 : maxMs,
          );
          return Column(
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 4,
                  overlayShape: const RoundSliderOverlayShape(
                    overlayRadius: 14,
                  ),
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 7,
                  ),
                  inactiveTrackColor: scheme.onSurface.withValues(alpha: 0.16),
                ),
                child: Slider(
                  min: 0,
                  max: maxMs <= 0 ? 1 : maxMs,
                  value: maxMs <= 0 ? 0 : valueMs,
                  onChanged: maxMs <= 0
                      ? null
                      : (v) => onScrubUpdate(
                          Duration(milliseconds: v.round()),
                        ),
                  onChangeStart: maxMs <= 0
                      ? null
                      : (v) => onScrubStart(
                          Duration(milliseconds: v.round()),
                        ),
                  onChangeEnd: maxMs <= 0
                      ? null
                      : (v) => onScrubEnd(Duration(milliseconds: v.round())),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatMmSs(live),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: surfaces.textMuted,
                    ),
                  ),
                  Text(
                    _formatMmSs(duration),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: surfaces.textMuted,
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      );
    }

    Widget controls({required double iconSize}) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          IconButton(
            tooltip: 'Shuffle',
            onPressed: onToggleShuffle,
            icon: Icon(
              Icons.shuffle,
              color: queue.shuffle ? scheme.primary : surfaces.textMuted,
            ),
          ),
          IconButton(
            tooltip: 'Previous',
            onPressed: onPrevious,
            icon: const Icon(Icons.skip_previous, size: 34),
          ),
          IconButton(
            tooltip: playing ? 'Pause' : 'Play',
            onPressed: onPlayPause,
            icon: Icon(
              playing
                  ? Icons.pause_circle_filled
                  : Icons.play_circle_fill,
              size: iconSize,
              color: DimensionTokens.neonCyan,
            ),
          ),
          IconButton(
            tooltip: 'Next',
            onPressed: queue.canSkipNext ? onNext : null,
            icon: const Icon(Icons.skip_next, size: 34),
          ),
          IconButton(
            tooltip: 'Repeat',
            onPressed: onToggleRepeat,
            icon: Icon(
              Icons.repeat,
              color: queue.repeat ? scheme.primary : surfaces.textMuted,
            ),
          ),
        ],
      );
    }

    Widget upNext() {
      final items = queue.queue;
      if (items.length <= 1) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Up next',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: surfaces.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          ...items.asMap().entries.map((entry) {
            final index = entry.key;
            final queued = entry.value;
            final isCurrent = index == queue.currentIndex;
            return ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              visualDensity: VisualDensity.compact,
              leading: Icon(
                isCurrent ? Icons.equalizer : Icons.music_note,
                size: 18,
                color: isCurrent ? scheme.primary : surfaces.textMuted,
              ),
              title: Text(
                queued.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isCurrent
                      ? scheme.primary
                      : surfaces.textSecondary,
                  fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
              subtitle: Text(
                queued.artistName ?? 'Artist',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: surfaces.textMuted,
                ),
              ),
              onTap: isCurrent ? null : () => onPlayAt(index),
            );
          }),
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isTablet =
            constraints.maxWidth >= DimensionTokens.breakpointTablet;
        final isWide = constraints.maxWidth >= DimensionTokens.breakpointWide;
        final isShortScreen = constraints.maxHeight < 760;
        final panelPadding = isShortScreen ? 12.0 : (isTablet ? 20.0 : 16.0);
        final outerPadding = isShortScreen ? 12.0 : (isTablet ? 24.0 : 16.0);
        final playIconSize = isShortScreen ? 56.0 : (isTablet ? 72.0 : 64.0);
        final compactArtSize = math.min(
          constraints.maxWidth,
          (constraints.maxHeight * 0.38)
              .clamp(180.0, isTablet ? 380.0 : 340.0)
              .toDouble(),
        );

        final art = SizedBox(
          width: isWide ? 360.0 : compactArtSize,
          child: albumArt(),
        );

        final details = glassPanel(
          padding: panelPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.queue_music, size: 16, color: surfaces.textMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      playlistTitle ?? 'Pro-Radio · on demand',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: surfaces.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: isShortScreen ? 8 : 12),
              Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: DimensionTypography.cardTitle(fontSize: 18),
              ),
              const SizedBox(height: 6),
              Text(
                item.artistName ?? 'Artist',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: surfaces.textSecondary,
                ),
              ),
              SizedBox(height: isShortScreen ? 10 : 14),
              progressBar(),
              SizedBox(height: isShortScreen ? 4 : 8),
              controls(iconSize: playIconSize),
              SizedBox(height: isShortScreen ? 8 : 12),
              SyncedLyricsPanel(
                songId: item.songId,
                positionStream: audio.positionStream,
                currentPosition: () => audio.position,
              ),
              SizedBox(height: isShortScreen ? 8 : 12),
              upNext(),
            ],
          ),
        );

        if (isWide) {
          return Padding(
            padding: EdgeInsets.all(outerPadding),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                art,
                const SizedBox(width: 24),
                Expanded(
                  child: SingleChildScrollView(child: details),
                ),
              ],
            ),
          );
        }

        return SingleChildScrollView(
          padding: EdgeInsets.all(outerPadding),
          child: Column(
            children: [
              art,
              const SizedBox(height: 16),
              details,
            ],
          ),
        );
      },
    );
  }
}

class _EmptyQueue extends StatelessWidget {
  const _EmptyQueue();

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.queue_music, size: 48, color: surfaces.textMuted),
            const SizedBox(height: 12),
            Text(
              'Nothing queued yet',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              'Play a playlist to start listening on demand.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: surfaces.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Contrast wash over the blurred cover (mirrors the radio player so both
/// players feel like one product).
class _PearlescentWash extends StatelessWidget {
  const _PearlescentWash();

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final base = DimensionTokens.isDark ? Colors.black : Colors.white;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            base.withValues(alpha: 0.55),
            base.withValues(alpha: 0.38),
            base.withValues(alpha: 0.86),
          ],
          stops: const [0.0, 0.32, 1.0],
        ),
      ),
    );
  }
}
