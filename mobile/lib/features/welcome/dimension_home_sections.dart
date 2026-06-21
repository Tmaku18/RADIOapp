import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/analytics/analytics_metrics.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/services/analytics_service.dart';
import '../../core/services/radio_presence_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../dimension/butterfly_hero_fallback.dart';

/// Mobile port of web [DimensionHomeSections].
class DimensionHomeSections extends StatefulWidget {
  const DimensionHomeSections({
    super.key,
    required this.stats,
    required this.trending,
    required this.onMineFrequency,
    required this.onGetStarted,
    required this.onExploreArtists,
  });

  final Map<String, dynamic>? stats;
  final TrendingData? trending;
  final VoidCallback onMineFrequency;
  final VoidCallback onGetStarted;
  final VoidCallback onExploreArtists;

  @override
  State<DimensionHomeSections> createState() => _DimensionHomeSectionsState();
}

class _DimensionHomeSectionsState extends State<DimensionHomeSections> {
  final AnalyticsService _analytics = AnalyticsService();
  Timer? _livePoll;
  Map<String, dynamic>? _liveStats;
  final AudioPlayer _clipPlayer = AudioPlayer();
  String? _playingId;
  bool _startingRadio = false;

  @override
  void initState() {
    super.initState();
    _liveStats = widget.stats;
    _livePoll = Timer.periodic(const Duration(seconds: 15), (_) => _pollLive());
  }

  Future<void> _pollLive() async {
    try {
      final res = await _analytics.getPlatformStats();
      if (!mounted || res == null) return;
      setState(() => _liveStats = res);
    } catch (_) {}
  }

  @override
  void dispose() {
    _livePoll?.cancel();
    _clipPlayer.dispose();
    super.dispose();
  }

  int _stat(String key) {
    final v = _liveStats?[key] ?? widget.stats?[key];
    if (v is num) return v.toInt();
    return 0;
  }

  Future<void> _mineFrequency() async {
    if (_startingRadio) return;
    setState(() => _startingRadio = true);
    try {
      final ok = await RadioGuestPlaybackService.instance.startLiveRadio();
      if (!mounted) return;
      if (ok) {
        widget.onMineFrequency();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not tune in. Try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _startingRadio = false);
    }
  }

  Future<void> _toggleClip(String id, String? url) async {
    if (url == null || url.isEmpty) return;
    if (_playingId == id) {
      await _clipPlayer.stop();
      setState(() => _playingId = null);
      return;
    }
    await _clipPlayer.setUrl(url);
    await _clipPlayer.play();
    setState(() => _playingId = id);
  }

  @override
  Widget build(BuildContext context) {
    final trending = widget.trending;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _HeroSection(
          liveListeners: _stat('liveListeners'),
          members: _stat('totalUsers'),
          songs: _stat('totalSongs'),
          ripples: _stat('totalLikes'),
          onMine: _mineFrequency,
          onGetStarted: widget.onGetStarted,
          onExplore: widget.onExploreArtists,
          mining: _startingRadio,
        ),
        if (trending != null && trending.songs.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 32, 20, 12),
            child: SectionLabel(number: '01', title: 'GEMS & DIAMONDS'),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'TRENDING NOW',
              style: GoogleFonts.unbounded(
                color: DimensionTokens.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 220,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: trending.songs.length.clamp(0, 12),
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, i) {
                final song = trending.songs[i];
                return _DimensionSongCard(
                  rank: i + 1,
                  title: song.title,
                  artist: song.artistName,
                  artworkUrl: song.artworkUrl,
                  temperature: song.temperaturePercent,
                  listens: resolveListens({
                    'listens': song.listens,
                    'earsReached': song.earsReached,
                    'playCount': song.playCount,
                  }),
                  ripples: song.likeCount,
                  isPlaying: _playingId == song.id,
                  onPlay: () => _toggleClip(song.id, song.clipUrl),
                );
              },
            ),
          ),
        ],
        if (trending != null && trending.artists.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
            child: SectionLabel(
              number: '02',
              title: 'CATALYSTS',
              color: DimensionTokens.neonPink,
            ),
          ),
          SizedBox(
            height: 120,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: trending.artists.length,
              itemBuilder: (context, i) {
                final a = trending.artists[i];
                return Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: GlassCard(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundImage: a.avatarUrl != null
                              ? CachedNetworkImageProvider(a.avatarUrl!)
                              : null,
                          child: a.avatarUrl == null
                              ? const Icon(Icons.person)
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              a.displayName,
                              style: GoogleFonts.outfit(
                                color: DimensionTokens.textPrimary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${formatMetricCount(a.listens)} ${AnalyticsMetrics.listens.label.toLowerCase()}',
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
                );
              },
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
          child: SectionLabel(
            number: '03',
            title: 'LIVE RADIO',
            color: DimensionTokens.neonYellow,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(
                child: _LiveStatCard(
                  label: AnalyticsMetrics.liveListeners.label,
                  sub: AnalyticsMetrics.liveListeners.shortSub,
                  value: formatMetricCount(_stat('liveListeners')),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LiveStatCard(
                  label: AnalyticsMetrics.listens.label,
                  sub: AnalyticsMetrics.listens.shortSub,
                  value: formatMetricCount(
                    _stat('totalListenCount') != 0
                        ? _stat('totalListenCount')
                        : _stat('listens'),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LiveStatCard(
                  label: AnalyticsMetrics.earsReached.label,
                  sub: AnalyticsMetrics.earsReached.shortSub,
                  value: formatMetricCount(_stat('earsReached')),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection({
    required this.liveListeners,
    required this.members,
    required this.songs,
    required this.ripples,
    required this.onMine,
    required this.onGetStarted,
    required this.onExplore,
    required this.mining,
  });

  final int liveListeners;
  final int members;
  final int songs;
  final int ripples;
  final VoidCallback onMine;
  final VoidCallback onGetStarted;
  final VoidCallback onExplore;
  final bool mining;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.88,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(child: CyberBackdrop()),
          Positioned(
            right: -20,
            top: 80,
            width: 280,
            height: 280,
            child: ButterflyHeroFallback(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GlassCard(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const LiveDot(),
                      const SizedBox(width: 8),
                      Text(
                        'BROADCASTING NOW · $liveListeners listeners',
                        style: GoogleFonts.jetBrainsMono(
                          color: DimensionTokens.neonPink,
                          fontSize: 9,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                GlitchText(
                  text: 'network.',
                  style: GoogleFonts.unbounded(
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    height: 1.05,
                  ),
                ),
                Text(
                  'Join the\nmovement.\nBuild your',
                  style: GoogleFonts.unbounded(
                    color: DimensionTokens.textPrimary,
                    fontSize: 36,
                    fontWeight: FontWeight.w900,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Whether you are a hidden gem, a Prospector, or a pro ready to mentor — '
                  'Networx is the underground frequency where culture is mined.',
                  style: GoogleFonts.outfit(
                    color: DimensionTokens.textSecondary,
                    fontSize: 15,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 20),
                DimensionCtaButton(
                  label: mining ? 'Tuning in…' : 'Mine The Frequency',
                  onPressed: mining ? null : onMine,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    DimensionCtaButton(
                      label: 'Get Started Free',
                      variant: DimensionCtaVariant.secondary,
                      onPressed: onGetStarted,
                    ),
                    const SizedBox(width: 10),
                    DimensionCtaButton(
                      label: 'Explore Artists',
                      variant: DimensionCtaVariant.pink,
                      onPressed: onExplore,
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _HeroStat(value: formatMetricCount(members), label: 'Members'),
                    _HeroStat(value: formatMetricCount(songs), label: 'Songs'),
                    _HeroStat(value: formatMetricCount(ripples), label: 'Ripples'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: GoogleFonts.unbounded(
              color: DimensionTokens.neonCyan,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label.toUpperCase(),
            style: GoogleFonts.jetBrainsMono(
              color: DimensionTokens.textMuted,
              fontSize: 9,
              letterSpacing: 2,
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveStatCard extends StatelessWidget {
  const _LiveStatCard({
    required this.label,
    required this.sub,
    required this.value,
  });

  final String label;
  final String sub;
  final String value;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const LiveDot(size: 6),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.unbounded(
              color: DimensionTokens.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            label,
            style: GoogleFonts.outfit(
              color: DimensionTokens.textPrimary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            sub,
            style: GoogleFonts.jetBrainsMono(
              color: DimensionTokens.textMuted,
              fontSize: 8,
            ),
          ),
        ],
      ),
    );
  }
}

class _DimensionSongCard extends StatelessWidget {
  const _DimensionSongCard({
    required this.rank,
    required this.title,
    required this.artist,
    required this.artworkUrl,
    required this.temperature,
    required this.listens,
    required this.ripples,
    required this.isPlaying,
    required this.onPlay,
  });

  final int rank;
  final String title;
  final String artist;
  final String? artworkUrl;
  final int temperature;
  final int listens;
  final int ripples;
  final bool isPlaying;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: GlassCard(
        padding: EdgeInsets.zero,
        onTap: onPlay,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(16),
                    ),
                    child: artworkUrl != null
                        ? CachedNetworkImage(
                            imageUrl: artworkUrl!,
                            fit: BoxFit.cover,
                          )
                        : ColoredBox(color: DimensionTokens.bgSurface),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Text(
                    '#${rank.toString().padLeft(2, '0')}',
                    style: GoogleFonts.jetBrainsMono(
                      color: DimensionTokens.textPrimary,
                      fontSize: 10,
                    ),
                  ),
                ),
                Positioned(
                  bottom: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$temperature°',
                      style: GoogleFonts.jetBrainsMono(
                        color: DimensionTokens.neonCyan,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ),
                if (isPlaying)
                  const Positioned.fill(
                    child: Center(
                      child: Icon(Icons.pause_circle, color: Colors.white, size: 40),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      color: DimensionTokens.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.outfit(
                      color: DimensionTokens.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${formatMetricCount(listens)} listens · $ripples ripples',
                    style: GoogleFonts.jetBrainsMono(
                      color: DimensionTokens.textMuted,
                      fontSize: 9,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
