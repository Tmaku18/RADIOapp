import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/services/audio_player_service.dart';
import '../core/brand/brand_assets.dart';
import '../core/navigation/app_routes.dart';
import '../core/theme/networx_tokens.dart';

/// Spotify-style persistent mini-player bar. Shown when there is a current
/// track/source. Tap opens full [PlayerScreen].
class MiniPlayerBar extends StatelessWidget {
  const MiniPlayerBar({super.key});

  @override
  Widget build(BuildContext context) {
    final audio = AudioPlayerService();
    return StreamBuilder<SequenceState?>(
      stream: audio.player.sequenceStateStream,
      builder: (context, seqSnapshot) {
        final state = seqSnapshot.data;
        final currentSource = state?.currentSource;
        final tag = currentSource?.tag;
        final mediaItem = tag is MediaItem ? tag : null;

        return StreamBuilder<PlayerState>(
          stream: audio.player.playerStateStream,
          builder: (context, playerSnapshot) {
            return ValueListenableBuilder<bool>(
              valueListenable: AudioPlayerService.handler.userPausedNotifier,
              builder: (context, userPaused, _) {
            final playerState = playerSnapshot.data ?? audio.player.playerState;
            final isPlaying = !userPaused && playerState.playing;
            final processingState = playerState.processingState;

            // Hide when no track is loaded (no current source with tag)
            if (mediaItem == null ||
                processingState == ProcessingState.idle ||
                processingState == ProcessingState.loading) {
              return const SizedBox.shrink();
            }

            return Material(
              color: NetworxTokens.charcoalMatte,
              child: InkWell(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.of(context).pushNamed(AppRoutes.player);
                },
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: _Artwork(mediaItem: mediaItem),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                mediaItem.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              Text(
                                mediaItem.artist ?? 'Radio',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade400,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          iconSize: 52,
                          icon: Icon(
                            isPlaying ? Icons.pause_circle : Icons.play_circle,
                          ),
                          onPressed: () async {
                            final handler = AudioPlayerService.handler;
                            await handler.setUserPaused(isPlaying);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
              },
            );
          },
        );
      },
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.mediaItem});

  final MediaItem mediaItem;

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    final artworkUrl = BrandAssets.displayArtworkUrl(mediaItem.artUri?.toString());

    if (artworkUrl != null) {
      return CachedNetworkImage(
        imageUrl: artworkUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => const _Placeholder(size: size),
        errorWidget: (context, url, error) => const _Placeholder(size: size),
      );
    }

    return const _Placeholder(size: size);
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Image.asset(
        BrandAssets.logoCyanAsset,
        fit: BoxFit.cover,
      ),
    );
  }
}
