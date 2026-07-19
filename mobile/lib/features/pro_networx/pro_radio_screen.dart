import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/services/audio_player_service.dart';

/// Lightweight radio surface inside the Pro-Networx shell. The actual audio is
/// owned by the global [AudioPlayerService] singleton, so playback persists
/// while users browse Home, Search, Services, etc.
class ProRadioScreen extends StatelessWidget {
  const ProRadioScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final audio = AudioPlayerService();
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Networks Radio',
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            'Audio keeps playing as you browse Pro-Networx. Tap any track to '
            'jump back to the full player.',
            style:
                theme.textTheme.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          StreamBuilder<SequenceState?>(
            stream: audio.player.sequenceStateStream,
            builder: (context, snap) {
              final source = snap.data?.currentSource;
              final tag = source?.tag;
              final mediaItem = tag is MediaItem ? tag : null;
              return Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.brightness == Brightness.dark
                          ? cs.surface.withValues(alpha: 0.62)
                          : cs.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: cs.outlineVariant),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: SizedBox(
                            width: 64,
                            height: 64,
                            child: mediaItem?.artUri != null
                                ? CachedNetworkImage(
                                    imageUrl: mediaItem!.artUri.toString(),
                                    fit: BoxFit.cover,
                                  )
                                : Container(
                                    color: cs.surfaceContainerHighest,
                                    child: const Icon(Icons.radio),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                mediaItem?.title ?? 'Networks Radio',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                mediaItem?.artist ?? 'Underground music · live',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: cs.onSurfaceVariant,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        StreamBuilder<PlayerState>(
                          stream: audio.player.playerStateStream,
                          builder: (context, ps) {
                            final playing = ps.data?.playing ?? false;
                            return IconButton(
                              icon: Icon(
                                  playing ? Icons.pause : Icons.play_arrow),
                              onPressed: () {
                                if (playing) {
                                  audio.player.pause();
                                } else {
                                  audio.player.play();
                                }
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      icon: const Icon(Icons.open_in_new),
                      label: const Text('Open full radio player'),
                      onPressed: () => Navigator.of(context).pushNamed(
                        AppRoutes.player,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
