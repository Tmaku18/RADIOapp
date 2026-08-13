import 'dart:ui';

import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../features/player/dimension_player_controller.dart';
import '../../features/player/widgets/synced_lyrics_panel.dart';
import '../../features/pro_radio/widgets/add_to_playlist_sheet.dart';
import 'dimension_widgets.dart';

/// The persistent now-playing bar.
///
/// Deliberately spare: artwork, what's playing, and transport. Reactions,
/// temperature, the equalizer animation and the add-to-playlist control used
/// to share this row too — ten targets across roughly 340 logical pixels — so
/// they now live in the full-screen player, one tap away, or in the long-press
/// menu here.
class DimensionRadioBar extends StatelessWidget {
  const DimensionRadioBar({super.key});

  static const double _artSize = 48;
  static const double _rowHeight = 64;

  /// Synced closed captions for owned/sample playback. The full-screen player
  /// is radio-only (it would tune the radio over the current track), so
  /// non-radio playback opens lyrics in a sheet instead.
  static void _showLyricsSheet(BuildContext context, MediaItem item) {
    final audio = AudioPlayerService().player;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: Theme.of(context).textTheme.titleMedium,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 12),
              SyncedLyricsPanel(
                songId: item.id,
                positionStream: audio.positionStream,
                currentPosition: () => audio.position,
                showEmptyMessage: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Everything that used to be crammed into the bar itself.
  static void _showActionsSheet(BuildContext context, MediaItem item) {
    final ctrl = dimensionPlayerController;
    HapticFeedback.selectionClick();
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: AnimatedBuilder(
          animation: ctrl,
          builder: (context, _) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(
                  ctrl.isFavorite ? Icons.star : Icons.star_border,
                  color: ctrl.isFavorite ? DimensionTokens.neonCyan : null,
                ),
                title: Text(ctrl.isFavorite ? 'In favorites' : 'Add to favorites'),
                onTap: ctrl.favoriteBusy ? null : ctrl.toggleFavorite,
              ),
              if (ctrl.canVote) ...[
                ListTile(
                  leading: const Text('🔥', style: TextStyle(fontSize: 20)),
                  title: const Text('Rate as fire'),
                  selected: ctrl.selectedReaction == 'fire',
                  onTap: () {
                    ctrl.submitReaction('fire');
                    Navigator.of(sheetContext).pop();
                  },
                ),
                ListTile(
                  leading: const Text('💩', style: TextStyle(fontSize: 20)),
                  title: const Text('Rate as trash'),
                  selected: ctrl.selectedReaction == 'shit',
                  onTap: () {
                    ctrl.submitReaction('shit');
                    Navigator.of(sheetContext).pop();
                  },
                ),
              ],
              if ((ctrl.playlistSongId ?? '').isNotEmpty)
                ListTile(
                  leading: const Icon(Icons.playlist_add),
                  title: const Text('Add to a playlist'),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    AddToPlaylistSheet.show(
                      context,
                      songId: ctrl.playlistSongId!,
                      songTitle: ctrl.playlistSongTitle,
                    );
                  },
                ),
              ListTile(
                leading: const Icon(Icons.lyrics_outlined),
                title: const Text('Lyrics'),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _showLyricsSheet(context, item);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final isDark = DimensionTokens.isDark;

    return AnimatedBuilder(
      animation: dimensionPlayerController,
      builder: (context, _) {
        final ctrl = dimensionPlayerController;
        final audio = AudioPlayerService().player;
        return StreamBuilder<SequenceState?>(
          stream: audio.sequenceStateStream,
          builder: (context, seqSnap) {
            final media = seqSnap.data?.currentSource?.tag;
            final item = media is MediaItem ? media : null;
            if (item == null) return const SizedBox.shrink();

            final bar = DecoratedBox(
              decoration: BoxDecoration(
                color: (isDark ? const Color(0xFF1C1C1E) : Colors.white)
                    .withValues(alpha: 0.86),
                border: Border(
                  top: BorderSide(color: DimensionTokens.glassBorder),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // A hairline of progress across the top edge. The old bar
                  // spent a whole row on a scrubber plus two timestamps; the
                  // full player is where you actually seek.
                  _ProgressHairline(progress: ctrl.progress),
                  SafeArea(
                    top: false,
                    child: SizedBox(
                      height: _rowHeight,
                      child: Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                final extras = item.extras;
                                final isRadio = extras == null ||
                                    extras['source'] == 'radio' ||
                                    extras['radioId'] != null;
                                if (isRadio) {
                                  Navigator.of(context)
                                      .pushNamed(AppRoutes.player);
                                } else {
                                  _showLyricsSheet(context, item);
                                }
                              },
                              onLongPress: () =>
                                  _showActionsSheet(context, item),
                              child: Padding(
                                padding: const EdgeInsets.only(left: 12),
                                child: Row(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(6),
                                      child: SizedBox(
                                        width: _artSize,
                                        height: _artSize,
                                        child: _Artwork(item: item),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            item.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              color:
                                                  DimensionTokens.textPrimary,
                                              fontWeight: FontWeight.w500,
                                              fontSize: 15,
                                              letterSpacing: -0.2,
                                            ),
                                          ),
                                          const SizedBox(height: 1),
                                          _SubtitleLine(
                                            text: item.artist ??
                                                'NETWORX Radio',
                                            live: ctrl.showLiveBadge,
                                            reconnecting: ctrl.isReconnecting,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          _BarButton(
                            icon: ctrl.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            iconSize: 32,
                            tooltip: ctrl.isPlaying ? 'Pause' : 'Play',
                            onPressed: ctrl.togglePlay,
                          ),
                          _BarButton(
                            icon: Icons.more_horiz_rounded,
                            iconSize: 22,
                            tooltip: 'More',
                            onPressed: () => _showActionsSheet(context, item),
                          ),
                          const SizedBox(width: 4),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );

            return ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: DimensionTokens.glassStrongBlur,
                  sigmaY: DimensionTokens.glassStrongBlur,
                ),
                child: bar,
              ),
            );
          },
        );
      },
    );
  }
}

class _ProgressHairline extends StatelessWidget {
  const _ProgressHairline({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 2,
      child: LinearProgressIndicator(
        value: (progress / 100).clamp(0.0, 1.0),
        minHeight: 2,
        backgroundColor: Colors.transparent,
        valueColor: AlwaysStoppedAnimation(
          DimensionTokens.textPrimary.withValues(alpha: 0.30),
        ),
      ),
    );
  }
}

class _SubtitleLine extends StatelessWidget {
  const _SubtitleLine({
    required this.text,
    required this.live,
    required this.reconnecting,
  });

  final String text;
  final bool live;
  final bool reconnecting;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      color: DimensionTokens.textSecondary,
      fontSize: 13,
      letterSpacing: -0.1,
    );

    if (!live) {
      return Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }

    return Row(
      children: [
        LiveDot(
          size: 6,
          color: reconnecting ? DimensionTokens.neonYellow : null,
        ),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            reconnecting ? 'Reconnecting' : text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: style,
          ),
        ),
      ],
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.iconSize = 24,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String tooltip;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      iconSize: iconSize,
      tooltip: tooltip,
      icon: Icon(icon),
      color: DimensionTokens.textPrimary,
      onPressed: onPressed,
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.item});
  final MediaItem item;

  @override
  Widget build(BuildContext context) {
    final uri = BrandAssets.mediaArtUri(item.artUri?.toString());
    return CachedNetworkImage(
      imageUrl: uri.toString(),
      fit: BoxFit.cover,
      errorWidget: (context, url, error) => ColoredBox(
        color: DimensionTokens.bgSurface,
        child: Icon(
          Icons.music_note,
          size: 20,
          color: DimensionTokens.textMuted,
        ),
      ),
    );
  }
}
