part of '../player_screen.dart';

/// A secondary control beside the play button — plain glyph, generous tap area.
class _PlayerAction extends StatelessWidget {
  const _PlayerAction({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.color,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: onPressed,
      tooltip: tooltip,
      iconSize: 26,
      color: color ?? DimensionTokens.textSecondary,
      icon: Icon(icon),
    );
  }
}

/// Reactions, crowd temperature and add-to-playlist as one quiet strip.
///
/// These were previously a bordered "Song temperature" card with its own
/// progress bar and emoji tallies, plus two more emoji buttons in the transport
/// row — the same information competing with itself in two places.
class _ReactionStrip extends StatelessWidget {
  const _ReactionStrip({
    required this.canVote,
    required this.isVoting,
    required this.selectedReaction,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.onReact,
    required this.onAddToPlaylist,
  });

  final bool canVote;
  final bool isVoting;
  final String? selectedReaction;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final void Function(String reaction) onReact;
  final VoidCallback onAddToPlaylist;

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final scheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _ReactionChip(
              emoji: '🔥',
              count: fireVotes,
              selected: selectedReaction == 'fire',
              enabled: canVote && !isVoting,
              onTap: () => onReact('fire'),
            ),
            const SizedBox(width: 10),
            _ReactionChip(
              emoji: '💩',
              count: shitVotes,
              selected: selectedReaction == 'shit',
              enabled: canVote && !isVoting,
              onTap: () => onReact('shit'),
            ),
            const SizedBox(width: 10),
            _PlayerAction(
              icon: Icons.playlist_add_rounded,
              tooltip: 'Add to playlist',
              onPressed: onAddToPlaylist,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 120,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  minHeight: 3,
                  value: temperaturePercent.clamp(0, 100) / 100,
                  backgroundColor:
                      DimensionTokens.textPrimary.withValues(alpha: 0.14),
                  valueColor: AlwaysStoppedAnimation(scheme.primary),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '$temperaturePercent% hot',
              style: TextStyle(
                fontSize: 12,
                color: DimensionTokens.textSecondary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ReactionChip extends StatelessWidget {
  const _ReactionChip({
    required this.emoji,
    required this.count,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String emoji;
  final int count;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: selected
          ? scheme.primary.withValues(alpha: 0.16)
          : DimensionTokens.textPrimary.withValues(alpha: 0.08),
      shape: StadiumBorder(
        side: BorderSide(
          color: selected ? scheme.primary : Colors.transparent,
        ),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 15)),
              const SizedBox(width: 6),
              Text(
                '$count',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: DimensionTokens.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Contrast wash over the blurred cover behind the player.
class _ArtworkScrim extends StatelessWidget {
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

/// App bar title: the station you're on, tappable to switch. Doubles as the
/// connection indicator so "RECONNECTING" doesn't need its own badge.
class _StationTitle extends StatelessWidget {
  const _StationTitle({
    required this.label,
    required this.reconnecting,
    required this.onTap,
    required this.onLight,
  });

  final String label;
  final bool reconnecting;
  final VoidCallback onTap;

  /// True when drawn over artwork, where everything must read as white.
  final bool onLight;

  @override
  Widget build(BuildContext context) {
    final color = onLight ? Colors.white : DimensionTokens.textPrimary;
    final subColor = onLight
        ? Colors.white.withValues(alpha: 0.7)
        : DimensionTokens.textSecondary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              reconnecting ? 'Reconnecting' : 'Live radio',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.2,
                color: reconnecting ? DimensionTokens.neonYellow : subColor,
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.2,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(width: 2),
                Icon(Icons.expand_more_rounded, size: 18, color: subColor),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ButterflyRippleOverlay extends StatelessWidget {
  const _ButterflyRippleOverlay({required this.progress});

  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final cyan = NetworxTokens.electricCyan;
    final lime = NetworxTokens.radioactiveLime;
    return AnimatedBuilder(
      animation: progress,
      builder: (context, _) {
        final t = Curves.easeOut.transform(progress.value.clamp(0.0, 1.0));
        final a1 = (1.0 - t) * 0.55;
        final a2 = (1.0 - t) * 0.38;
        final scale = 0.85 + (t * 0.35);

        return Container(
          color: Colors.transparent,
          child: Stack(
            children: [
              Positioned.fill(
                child: Opacity(
                  opacity: (1.0 - t) * 0.35,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: const Alignment(0, -0.1),
                        radius: 1.0,
                        colors: [
                          cyan.withValues(alpha: a1),
                          lime.withValues(alpha: a2),
                          scheme.surface.withValues(alpha: 0.0),
                        ],
                        stops: const [0.0, 0.35, 0.8],
                      ),
                    ),
                  ),
                ),
              ),
              Center(
                child: Transform.scale(
                  scale: scale,
                  child: Container(
                    width: 360,
                    height: 360,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: cyan.withValues(alpha: (1.0 - t) * 0.22),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: cyan.withValues(alpha: (1.0 - t) * 0.28),
                          blurRadius: 80,
                          spreadRadius: 18,
                        ),
                        BoxShadow(
                          color: lime.withValues(alpha: (1.0 - t) * 0.18),
                          blurRadius: 140,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _NoContent extends StatelessWidget {
  final String? message;
  final VoidCallback onRetry;
  final VoidCallback onChangeStation;
  const _NoContent({
    required this.message,
    required this.onRetry,
    required this.onChangeStation,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Padding(
      padding: const EdgeInsets.all(16),
      child: GlassCard(
        padding: const EdgeInsets.all(18),
        child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('📻', style: TextStyle(fontSize: 56)),
              const SizedBox(height: 12),
              Text(
                'Station Offline',
                style: DimensionTypography.cardTitle(fontSize: 18),
              ),
              const SizedBox(height: 8),
              Text(
                message ?? 'No songs are currently available.',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: surfaces.textSecondary),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: onChangeStation,
                icon: const Icon(Icons.swap_horiz),
                label: const Text('Change station'),
              ),
            ],
          ),
      ),
    );
  }
}

String _roleLabel(String role) {
  switch (role) {
    case 'cover_art':
      return 'Cover art';
    case 'video':
      return 'Video';
    case 'production':
      return 'Production';
    case 'photo':
      return 'Photo';
    default:
      return 'Credits';
  }
}

class _VenueAdCard extends StatelessWidget {
  final VenueAd ad;
  const _VenueAdCard({required this.ad});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Card(
      child: InkWell(
        onTap: ad.linkUrl == null || ad.linkUrl!.isEmpty
            ? null
            : () async {
                final uri = Uri.tryParse(ad.linkUrl!);
                if (uri != null) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              },
        borderRadius: BorderRadius.circular(16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 16 / 5,
                child: CachedNetworkImage(
                  imageUrl: ad.imageUrl,
                  fit: BoxFit.cover,
                  errorWidget: (context, url, error) => Container(
                    color: surfaces.elevated,
                    alignment: Alignment.center,
                    child: Text(
                      'Venue partner',
                      style: TextStyle(color: surfaces.textSecondary),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 10,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Text(
                    'Venue Partner',
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlayerBody extends StatelessWidget {
  final Track track;
  final String radioId;
  final String stationLabel;
  final VoidCallback onChangeStation;
  final Future<void> Function(int direction) onCycleStation;
  final String? risingStarText;
  final VenueAd? ad;
  final bool isPlaying;
  final bool hasVoted;
  final bool isVoting;
  final String? selectedReaction;
  final bool isFavorite;
  final bool favoriteBusy;
  final bool canVote;
  final int fireVotes;
  final int shitVotes;
  final int temperaturePercent;
  final SongAccess? songAccess;
  final bool isBuying;
  final VoidCallback onBuy;
  final Future<void> Function(String reaction) onReact;
  final VoidCallback onToggleFavorite;
  final VoidCallback onAddToPlaylist;
  final VoidCallback onPlayPause;
  final VoidCallback onEnterRoom;
  final AudioPlayer audioPlayer;

  const _PlayerBody({
    required this.track,
    required this.radioId,
    required this.stationLabel,
    required this.onChangeStation,
    required this.onCycleStation,
    required this.risingStarText,
    required this.ad,
    required this.isPlaying,
    required this.hasVoted,
    required this.isVoting,
    required this.selectedReaction,
    required this.isFavorite,
    required this.favoriteBusy,
    required this.canVote,
    required this.fireVotes,
    required this.shitVotes,
    required this.temperaturePercent,
    required this.songAccess,
    required this.isBuying,
    required this.onBuy,
    required this.onReact,
    required this.onToggleFavorite,
    required this.onAddToPlaylist,
    required this.onPlayPause,
    required this.onEnterRoom,
    required this.audioPlayer,
  });

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    Widget albumArt() {
      final artworkUrl = BrandAssets.displayArtworkUrl(track.artworkUrl);
      return GestureDetector(
        onDoubleTap: () {
          AppHaptics.light();
          onReact('fire');
        },
        onHorizontalDragEnd: (details) {
          final velocity = details.primaryVelocity ?? 0;
          if (velocity.abs() < 250) return;
          onCycleStation(velocity < 0 ? 1 : -1);
        },
        child: AspectRatio(
        aspectRatio: 1,
        child: Hero(
          tag: 'now-playing-art',
          child: DecoratedBox(
          // The one place in the app that gets a real drop shadow — it lifts
          // the cover off its own blurred backdrop.
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            boxShadow: DimensionTokens.artworkShadow(blur: 36),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(DimensionTokens.artworkRadius),
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (artworkUrl != null)
                  FloatingAlbumScene(
                    key: ValueKey(artworkUrl),
                    imageUrl: artworkUrl,
                    floatAmplitude: 0,
                    borderRadius: BorderRadius.zero,
                  )
                else
                  const ButterflySwarmBackdrop(
                    butterflyCount: 12,
                    intensity: 0.9,
                  ),
                if (track.isLiveBroadcast)
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: scheme.primary,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        'Live',
                        style: TextStyle(
                          color: scheme.onPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
          ),
        ),
      );
    }

    // No panel. Track details sit directly on the scrimmed artwork, the way a
    // now-playing screen should — a translucent card floating over a blurred
    // copy of the same image was two layers of frosting on one cake.
    Widget glassPanel({required Widget child, double padding = 16}) {
      return Padding(
        padding: EdgeInsets.symmetric(horizontal: padding * 0.25),
        child: child,
      );
    }

    Widget buyAction() {
      final access = songAccess;
      if (access?.owned == true) {
        final label = access!.isOwner ? 'Your upload' : 'Owned · in your library';
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: scheme.primary.withValues(alpha: 0.30)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 18, color: scheme.primary),
              const SizedBox(width: 8),
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
      }

      final forSale = access?.forSale != false;
      final label = isBuying
          ? 'Starting…'
          : !forSale
          ? 'Not for sale'
          : access != null
          ? 'Buy ${_formatSongPrice(access.priceCents)}'
          : 'Buy song';

      return SizedBox(
        width: double.infinity,
        child: FilledButton.tonalIcon(
          onPressed: (!forSale || isBuying) ? null : onBuy,
          icon: isBuying
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.shopping_cart_outlined, size: 18),
          label: Text(label),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isTablet = constraints.maxWidth >= DimensionTokens.breakpointTablet;
        final isWide = constraints.maxWidth >= DimensionTokens.breakpointWide;
        final isDesktop = constraints.maxWidth >= DimensionTokens.breakpointDesktop;
        final isShortScreen =
            constraints.maxHeight < 760 && !isDesktop;
        final panelPadding = isShortScreen ? 12.0 : (isTablet ? 20.0 : 16.0);
        final sectionGap = isShortScreen ? 8.0 : (isTablet ? 14.0 : 12.0);
        final titleGap = isShortScreen ? 4.0 : 6.0;
        final metaGap = isShortScreen ? 6.0 : 8.0;
        final beforeProgressGap = isShortScreen ? 10.0 : (isTablet ? 18.0 : 14.0);
        final afterProgressGap = isShortScreen ? 8.0 : (isTablet ? 14.0 : 10.0);
        final outerPadding = isShortScreen ? 12.0 : (isTablet ? 24.0 : 16.0);
        final controlsIconSize = isShortScreen
            ? 48.0
            : (isTablet ? 64.0 : 52.0);
        final wideArtWidth = isDesktop
            ? 400.0
            : isWide
                ? 360.0
                : 320.0;
        final compactTargetHeight =
            constraints.maxHeight * (ad != null ? 0.30 : 0.38);
        final compactArtSize = math.min(
          constraints.maxWidth,
          compactTargetHeight.clamp(180.0, isTablet ? 380.0 : 340.0).toDouble(),
        );
        final art = SizedBox(
          width: isWide ? wideArtWidth : compactArtSize,
          child: albumArt(),
        );
        final details = glassPanel(
          padding: panelPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Station: $stationLabel',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: surfaces.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: onChangeStation,
                    child: const Text('Stations'),
                  ),
                ],
              ),
              SizedBox(height: sectionGap),
              if (risingStarText != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: scheme.primary.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Butterfly Ripple',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.primary,
                          letterSpacing: 0.8,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        risingStarText!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: surfaces.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: sectionGap),
              ],
              Text(
                track.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: DimensionTypography.cardTitle(fontSize: 18),
              ),
              SizedBox(height: titleGap),
              GestureDetector(
                onTap: () {
                  ApiService().post('analytics/profile-click', {
                    'songId': track.id,
                  });
                  final artistId = track.artistId;
                  if (artistId != null &&
                      artistId.isNotEmpty &&
                      context.mounted) {
                    Navigator.pushNamed(
                      context,
                      AppRoutes.artistProfile,
                      arguments: artistId,
                    );
                  }
                },
                child: Text(
                  track.artistName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: surfaces.textSecondary,
                  ),
                ),
              ),
              SizedBox(height: metaGap),
              Row(
                children: [
                  Icon(
                    Icons.people_alt_outlined,
                    size: 16,
                    color: surfaces.textMuted,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '${AnalyticsMetrics.liveListeners.label}: ${isPlaying && track.listenerCount < 1 ? 1 : track.listenerCount}',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: surfaces.textSecondary,
                    ),
                  ),
                ],
              ),
              if (track.pinnedCatalysts.isNotEmpty) ...[
                const SizedBox(height: 10),
                ...track.pinnedCatalysts.take(2).map((c) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Text(
                          '${_roleLabel(c.role)} by ',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: surfaces.textMuted,
                                letterSpacing: 0.3,
                              ),
                        ),
                        Expanded(
                          child: Text(
                            c.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              SizedBox(height: beforeProgressGap),
              StreamBuilder<Duration>(
                stream: audioPlayer.positionStream,
                builder: (context, snap) {
                  final pos = snap.data ?? Duration.zero;
                  final dur = audioPlayer.duration ?? Duration.zero;
                  final value = (dur.inMilliseconds <= 0)
                      ? 0.0
                      : (pos.inMilliseconds / dur.inMilliseconds).clamp(
                          0.0,
                          1.0,
                        );
                  return Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 4,
                          value: value,
                          backgroundColor: scheme.onSurface.withValues(
                            alpha: 0.12,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _formatMmSs(pos),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                          Text(
                            _formatMmSs(dur),
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
              SizedBox(height: afterProgressGap),
              // Transport comes first now, and it is one big centered play
              // control flanked by the two most-used actions. It used to be
              // seven targets — play, chat, two emoji vote buttons, favourite,
              // playlist — jammed into a single row.
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _PlayerAction(
                    icon: Icons.forum_outlined,
                    tooltip: 'The Room',
                    onPressed: onEnterRoom,
                  ),
                  SizedBox(width: isShortScreen ? 28 : 40),
                  Semantics(
                    button: true,
                    label: isPlaying ? 'Pause' : 'Play',
                    child: IconButton(
                      onPressed: () {
                        AppHaptics.light();
                        onPlayPause();
                      },
                      iconSize: controlsIconSize,
                      padding: EdgeInsets.zero,
                      color: scheme.onSurface,
                      tooltip: isPlaying ? 'Pause' : 'Play',
                      icon: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 180),
                        child: Icon(
                          isPlaying
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          key: ValueKey(isPlaying),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: isShortScreen ? 28 : 40),
                  _PlayerAction(
                    icon: isFavorite ? Icons.star : Icons.star_border,
                    tooltip: isFavorite
                        ? 'Remove from Favorites'
                        : 'Add to Favorites',
                    color: isFavorite ? scheme.primary : null,
                    onPressed: favoriteBusy ? null : onToggleFavorite,
                  ),
                ],
              ),
              SizedBox(height: afterProgressGap),
              _ReactionStrip(
                canVote: canVote,
                isVoting: isVoting,
                selectedReaction: selectedReaction,
                fireVotes: fireVotes,
                shitVotes: shitVotes,
                temperaturePercent: temperaturePercent,
                onReact: onReact,
                onAddToPlaylist: onAddToPlaylist,
              ),
              SizedBox(height: afterProgressGap),
              buyAction(),
              SizedBox(height: afterProgressGap),
              SyncedLyricsPanel(
                songId: track.id,
                positionStream: audioPlayer.positionStream,
                currentPosition: () => audioPlayer.position,
              ),
              SizedBox(height: afterProgressGap),
              RadioUpNextQueue(
                radioId: radioId,
                currentId: track.id,
                compact: true,
              ),
            ],
          ),
        );

        return Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: isWide
                  ? DimensionTokens.maxContentWidth
                  : double.infinity,
            ),
            child: SingleChildScrollView(
          padding: EdgeInsets.all(outerPadding),
          child: isWide
              ? Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        art,
                        if (!reduceMotion) ...[
                          const SizedBox(height: 12),
                          SizedBox(
                            width: wideArtWidth,
                            child: FrequencyVisualizer(isPlaying: isPlaying),
                          ),
                        ],
                      ],
                    ),
                    SizedBox(width: outerPadding),
                    Expanded(child: details),
                  ],
                )
              : Column(
                  children: [
                    if (ad != null) ...[
                      _VenueAdCard(ad: ad!),
                      SizedBox(height: sectionGap),
                    ],
                    art,
                    if (!reduceMotion) ...[
                      const SizedBox(height: 12),
                      FrequencyVisualizer(isPlaying: isPlaying),
                    ],
                    SizedBox(height: outerPadding),
                    details,
                  ],
                ),
            ),
          ),
        );
      },
    );
  }
}

String _formatMmSs(Duration d) {
  final m = d.inMinutes;
  final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$m:$s';
}

/// Formats a cents amount as a dollar price, dropping a trailing ".00"
/// (e.g. 99 → "$0.99", 100 → "$1"). Mirrors the web RadioPlayer's price label.
String _formatSongPrice(int cents) {
  final text = (cents / 100).toStringAsFixed(2);
  return '\$${text.endsWith('.00') ? text.substring(0, text.length - 3) : text}';
}

// ---------------------------------------------------------------------------
// Station picker bottom-sheet with sort & favorites
// ---------------------------------------------------------------------------

const String _favStationsPrefKey = 'favorite_station_ids';

enum _StationSort { alpha, songs, favorites }

class _StationPickerSheet extends StatefulWidget {
  final String currentId;
  final ApiService api;
  const _StationPickerSheet({required this.currentId, required this.api});

  @override
  State<_StationPickerSheet> createState() => _StationPickerSheetState();
}

class _StationPickerSheetState extends State<_StationPickerSheet> {
  _StationSort _sort = _StationSort.songs;
  Set<String> _favs = {};
  Map<String, int> _counts = {};
  bool _loadingCounts = true;

  @override
  void initState() {
    super.initState();
    _loadFavs();
    _loadCounts();
  }

  Future<void> _loadFavs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_favStationsPrefKey) ?? [];
    if (mounted) setState(() => _favs = raw.toSet());
  }

  Future<void> _saveFavs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_favStationsPrefKey, _favs.toList());
  }

  Future<void> _loadCounts() async {
    try {
      final res = await widget.api.get('songs/station-counts');
      if (res is Map<String, dynamic>) {
        final raw = (res['counts'] as Map?)?.cast<String, dynamic>() ?? {};
        final parsed = <String, int>{};
        for (final e in raw.entries) {
          parsed[e.key] = (e.value is int) ? e.value as int : 0;
        }
        if (mounted) setState(() => _counts = parsed);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingCounts = false);
  }

  void _toggleFav(String id) {
    setState(() {
      if (_favs.contains(id)) {
        _favs.remove(id);
      } else {
        _favs.add(id);
      }
    });
    _saveFavs();
  }

  List<StationOption> get _sorted {
    final list = List<StationOption>.from(kStationCatalog);
    switch (_sort) {
      case _StationSort.alpha:
        list.sort((a, b) => a.genre.compareTo(b.genre));
      case _StationSort.songs:
        list.sort(
            (a, b) => (_counts[b.id] ?? 0).compareTo(_counts[a.id] ?? 0));
      case _StationSort.favorites:
        list.sort((a, b) {
          final af = _favs.contains(a.id) ? 1 : 0;
          final bf = _favs.contains(b.id) ? 1 : 0;
          if (af != bf) return bf - af;
          return a.genre.compareTo(b.genre);
        });
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final stations = _sorted;

    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            const ListTile(
              title: Text('Change station'),
              subtitle: Text('Pick a genre to tune into'),
            ),
            // Sort chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Text(
                    'Sort: ',
                    style: TextStyle(
                      color: scheme.outline,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(width: 4),
                  _sortChip('A–Z', _StationSort.alpha),
                  const SizedBox(width: 6),
                  _sortChip('Most Songs', _StationSort.songs),
                  const SizedBox(width: 6),
                  _sortChip('Favorites', _StationSort.favorites),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: stations.length,
                itemBuilder: (context, idx) {
                  final station = stations[idx];
                  final active = station.id == widget.currentId;
                  final isFav = _favs.contains(station.id);
                  final count = _counts[station.id] ?? 0;
                  return ListTile(
                    leading: Icon(
                      active
                          ? Icons.radio_button_checked
                          : Icons.radio_button_off,
                      color: active ? scheme.primary : null,
                    ),
                    title: Text(station.genre),
                    subtitle: Text(
                      _loadingCounts
                          ? 'National'
                          : count > 0
                              ? '$count song${count != 1 ? 's' : ''}'
                              : 'No songs yet',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            isFav ? Icons.star : Icons.star_border,
                            color: isFav ? Colors.amber : scheme.outline,
                          ),
                          onPressed: () => _toggleFav(station.id),
                          visualDensity: VisualDensity.compact,
                        ),
                        if (active)
                          Icon(Icons.check, color: scheme.primary),
                      ],
                    ),
                    onTap: () => Navigator.pop(context, station),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sortChip(String label, _StationSort value) {
    final active = _sort == value;
    return GestureDetector(
      onTap: () => setState(() => _sort = value),
      child: Chip(
        label: Text(
          label,
          style: TextStyle(fontSize: 12, fontWeight: active ? FontWeight.w600 : null),
        ),
        backgroundColor: active
            ? Theme.of(context).colorScheme.secondaryContainer
            : null,
        padding: EdgeInsets.zero,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}
