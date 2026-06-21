import 'dart:ui';

import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../features/player/dimension_player_controller.dart';
import 'dimension_widgets.dart';

/// Emergent bottom radio bar — web [DimensionRadioBar] parity.
class DimensionRadioBar extends StatelessWidget {
  const DimensionRadioBar({super.key});

  @override
  Widget build(BuildContext context) {
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

            return ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: DimensionTokens.glassStrongBlur,
                  sigmaY: DimensionTokens.glassStrongBlur,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF08080A).withValues(alpha: 0.92),
                    border: Border(
                      top: BorderSide(
                        color: DimensionTokens.neonCyan.withValues(alpha: 0.15),
                      ),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const NeonLine(),
                      SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  InkWell(
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      Navigator.of(context)
                                          .pushNamed(AppRoutes.player);
                                    },
                                    borderRadius: BorderRadius.circular(8),
                                    child: Row(
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: SizedBox(
                                            width: 48,
                                            height: 48,
                                            child: _Artwork(item: item),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        SizedBox(
                                          width: MediaQuery.sizeOf(context).width * 0.28,
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              if (ctrl.showLiveBadge)
                                                const LiveDot(label: 'LIVE'),
                                              Text(
                                                item.title,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: GoogleFonts.outfit(
                                                  color: DimensionTokens.textPrimary,
                                                  fontWeight: FontWeight.w600,
                                                  fontSize: 13,
                                                ),
                                              ),
                                              Text(
                                                item.artist ?? 'NETWORX Radio',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: GoogleFonts.outfit(
                                                  color: DimensionTokens.textSecondary,
                                                  fontSize: 11,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.skip_previous),
                                    color: DimensionTokens.textPrimary,
                                    onPressed: ctrl.canSkip ? ctrl.seekPrev : null,
                                  ),
                                  IconButton(
                                    iconSize: 40,
                                    icon: Icon(
                                      ctrl.isPlaying
                                          ? Icons.pause_circle_filled
                                          : Icons.play_circle_filled,
                                    ),
                                    color: DimensionTokens.neonCyan,
                                    onPressed: () => ctrl.togglePlay(),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.skip_next),
                                    color: DimensionTokens.textPrimary,
                                    onPressed: ctrl.canSkip ? ctrl.seekNext : null,
                                  ),
                                  Expanded(
                                    child: VbarVisualizer(
                                      isPlaying: ctrl.isPlaying,
                                      height: 24,
                                    ),
                                  ),
                                  if (ctrl.temperature != null)
                                    Padding(
                                      padding: const EdgeInsets.only(left: 4),
                                      child: Text(
                                        '${ctrl.temperature}°',
                                        style: GoogleFonts.jetBrainsMono(
                                          color: DimensionTokens.neonCyan,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  if (ctrl.canVote) ...[
                                    _VoteBtn(
                                      emoji: '💩',
                                      selected: ctrl.selectedReaction == 'shit',
                                      onTap: () => ctrl.submitReaction('shit'),
                                    ),
                                    _VoteBtn(
                                      emoji: '🔥',
                                      selected: ctrl.selectedReaction == 'fire',
                                      onTap: () => ctrl.submitReaction('fire'),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Text(
                                    ctrl.elapsedLabel,
                                    style: GoogleFonts.jetBrainsMono(
                                      color: DimensionTokens.textMuted,
                                      fontSize: 10,
                                    ),
                                  ),
                                  Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: LinearProgressIndicator(
                                          value: ctrl.progress / 100,
                                          minHeight: 4,
                                          backgroundColor:
                                              Colors.white.withValues(alpha: 0.08),
                                          valueColor: AlwaysStoppedAnimation(
                                            DimensionTokens.neonCyan,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  Text(
                                    ctrl.totalLabel,
                                    style: GoogleFonts.jetBrainsMono(
                                      color: DimensionTokens.textMuted,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
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
      errorWidget: (_, __, ___) => ColoredBox(
        color: DimensionTokens.bgSurface,
        child: Icon(Icons.music_note, color: DimensionTokens.neonCyan),
      ),
    );
  }
}

class _VoteBtn extends StatelessWidget {
  const _VoteBtn({
    required this.emoji,
    required this.selected,
    required this.onTap,
  });

  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected
          ? DimensionTokens.neonCyan.withValues(alpha: 0.15)
          : Colors.white.withValues(alpha: 0.05),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Text(emoji, style: const TextStyle(fontSize: 16)),
        ),
      ),
    );
  }
}
