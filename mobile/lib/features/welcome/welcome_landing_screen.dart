import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/services/analytics_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_radio_bar.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'dimension_home_sections.dart';

/// Public pre-login landing for Networx Radio. Mirrors the web marketing home
/// (`web/src/app/(marketing)/page.tsx`): hero + value props + live platform
/// stats + the "Language of Networx" glossary, with CTAs into sign up / log in
/// and the Pro-Networx landing.
///
/// Shown by [AuthWrapper] as the first screen for signed-out users.
class WelcomeLandingScreen extends StatefulWidget {
  const WelcomeLandingScreen({super.key});

  @override
  State<WelcomeLandingScreen> createState() => _WelcomeLandingScreenState();
}

class _WelcomeLandingScreenState extends State<WelcomeLandingScreen> {
  final AnalyticsService _analytics = AnalyticsService();
  final SongsService _songs = SongsService();
  Map<String, dynamic>? _stats;
  TrendingData? _trending;
  bool _loadingHome = true;
  String? _homeLoadError;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadHomeData();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadHomeData() async {
    setState(() {
      _loadingHome = true;
      _homeLoadError = null;
    });
    try {
      final results = await Future.wait([
        _analytics.getPlatformStats(),
        _songs.getPublicTrending(limit: 12),
      ]);
      if (!mounted) return;
      setState(() {
        _stats = results[0] as Map<String, dynamic>?;
        _trending = results[1] as TrendingData?;
        _loadingHome = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingHome = false;
        _homeLoadError = 'Could not load live stats and trending content.';
      });
    }
  }

  void _goToSignUp() {
    Navigator.of(context).pushNamed(AppRoutes.login, arguments: {'signUp': true});
  }

  void _goToLogin() {
    Navigator.of(context).pushNamed(AppRoutes.login);
  }

  void _goToProNetworx() {
    Navigator.of(context).pushNamed(AppRoutes.proNetworxLanding);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      backgroundColor: DimensionTokens.bgBase,
      body: Stack(
        children: [
          const Positioned.fill(child: CyberBackdrop()),
          ListView(
            controller: _scrollController,
            padding: const EdgeInsets.only(
              bottom: DimensionTokens.radioBarHeight + 32,
            ),
            children: [
              if (_loadingHome)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_homeLoadError != null)
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Text(
                        _homeLoadError!,
                        textAlign: TextAlign.center,
                        style: TextStyle(color: cs.onSurface.withValues(alpha: 0.7)),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: _loadHomeData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              else
                DimensionHomeSections(
                  stats: _stats,
                  trending: _trending,
                  onMineFrequency: () {},
                  onGetStarted: _goToSignUp,
                  onExploreArtists: _goToProNetworx,
                  onLogin: _goToLogin,
                ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
                child: NeonLine(),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                  Text(
                    'Build your audience, team, and career in one platform',
                    style: DimensionTypography.cardTitle(fontSize: 20),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Always-on radio, livestreams, votes and ripples, transparent '
                    'analytics, and ProNetworx mentorship — everything you need to be '
                    'discovered.',
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: cs.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 18),
                  ..._valueProps.map(
                    (vp) => _FeatureRow(
                      icon: vp.icon,
                      title: vp.title,
                      description: vp.description,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _ProNetworxTeaser(onExplore: _goToProNetworx),
                  const SizedBox(height: 32),
                  Text(
                    'The Language of Networx',
                    style: DimensionTypography.cardTitle(fontSize: 20),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Our world runs on three ideas: the Butterfly Effect, the '
                    "artist's Metamorphosis, and the Mining of hidden talent.",
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ..._glossary.map((g) => _GlossaryGroup(group: g)),
                  const SizedBox(height: 16),
                  _FinalCta(
                    onGetStarted: _goToSignUp,
                    onLogin: _goToLogin,
                  ),
                  const SizedBox(height: 24),
                  Center(
                    child: Text(
                      'By Artists, For Artists.',
                      style: DimensionTypography.bodyMuted().copyWith(
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 8, right: 12),
                child: OutlinedButton(
                  onPressed: _goToLogin,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: DimensionTokens.cyan300,
                    side: BorderSide(
                      color: DimensionTokens.cyan300.withValues(alpha: 0.35),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                  child: Text(
                    'LOG IN',
                    style: DimensionTypography.monoCaps(
                      color: DimensionTokens.cyan300,
                      fontSize: 10,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: DimensionRadioBar(),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.onGetStarted, required this.onLogin});

  final VoidCallback onGetStarted;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final onHero =
        isDark ? NetworxTokens.cloudDancer : NetworxTokens.lightTextPrimary;
    final logoAsset = isDark
        ? 'assets/images/branding/networx-logo-cyan.png'
        : 'assets/images/branding/networx-logo-cyan-light.png';
    final wordmarkStops = isDark
        ? const [
            Color(0xFFEAFEFF),
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
          ]
        : const [
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
            NetworxTokens.deepCobalt,
          ];
    final gradientColors = isDark
        ? const [
            NetworxTokens.deepMidnight,
            NetworxTokens.charcoalMatte,
            NetworxTokens.deepCobalt,
          ]
        : const [
            Color(0xFFFAFAFA),
            Color(0xFFFFFFFF),
            Color(0xFFE6FBFF),
          ];

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradientColors,
        ),
      ),
      padding: const EdgeInsets.fromLTRB(24, 36, 24, 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Image.asset(
                  logoAsset,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShaderMask(
                      shaderCallback: (bounds) => LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: wordmarkStops,
                      ).createShader(bounds),
                      child: Text(
                        'NETWORX RADIO',
                        style: textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                    Text(
                      'The Butterfly Effect',
                      style: DimensionTypography.accentCyan(fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          Text(
            'Join the movement and build your network',
            style: textTheme.headlineSmall?.copyWith(
              color: onHero,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Whether you are a hidden gem ready to be heard, a Prospector '
            'discovering new talent, or a pro ready to mentor, Networx and '
            'ProNetworx create the bridge.',
            style: textTheme.bodyLarge?.copyWith(
              color: onHero.withValues(alpha: 0.78),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onGetStarted,
                  style: FilledButton.styleFrom(
                    backgroundColor: NetworxTokens.electricCyan,
                    foregroundColor: NetworxTokens.deepMidnight,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Get Started Free'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: onLogin,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: onHero,
                    side: BorderSide(
                      color: onHero.withValues(alpha: 0.3),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Log in'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Always free to listen.',
            style: textTheme.bodySmall?.copyWith(
              color: onHero.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProNetworxTeaser extends StatelessWidget {
  const _ProNetworxTeaser({required this.onExplore});

  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: cs.primary.withValues(alpha: 0.06),
        border: Border.all(color: cs.primary.withValues(alpha: 0.2)),
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'A network for every kind of creative',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'ProNetworx is where designers, photographers, videographers, '
            'lyricists, beat makers and more post work, get hired, and connect. '
            'One login works for both Networx Radio and ProNetworx.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onExplore,
            icon: const Icon(Icons.arrow_forward, size: 18),
            label: const Text('Explore ProNetworx'),
          ),
        ],
      ),
    );
  }
}

class _FinalCta extends StatelessWidget {
  const _FinalCta({required this.onGetStarted, required this.onLogin});

  final VoidCallback onGetStarted;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: cs.primary.withValues(alpha: 0.08),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ready to get started?',
            style: DimensionTypography.cardTitle(fontSize: 20),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onGetStarted,
                  child: const Text('Get Started Free'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: onLogin,
                  child: const Text('Log in'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: cs.primary.withValues(alpha: 0.12),
            child: Icon(icon, color: cs.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: cs.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _formatTrendingCount(int n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
  return n.toString();
}

Color _tempColor(int t) {
  if (t >= 75) return Colors.orange;
  if (t >= 50) return Colors.amber;
  return Colors.lightBlue;
}

class _TrendingShowcase extends StatefulWidget {
  const _TrendingShowcase({
    required this.data,
    required this.onGetStarted,
  });

  final TrendingData data;
  final VoidCallback onGetStarted;

  @override
  State<_TrendingShowcase> createState() => _TrendingShowcaseState();
}

class _TrendingShowcaseState extends State<_TrendingShowcase> {
  final AudioPlayer _clipPlayer = AudioPlayer();
  String? _playingId;
  StreamSubscription<PlayerState>? _playerStateSub;

  @override
  void initState() {
    super.initState();
    _playerStateSub = _clipPlayer.playerStateStream.listen((state) {
      if (!mounted) return;
      if (state.processingState == ProcessingState.completed) {
        setState(() => _playingId = null);
      }
    });
  }

  @override
  void dispose() {
    _playerStateSub?.cancel();
    unawaited(_clipPlayer.dispose());
    super.dispose();
  }

  bool _isPlaying(TrendingSong song) =>
      _playingId == song.id && _clipPlayer.playing;

  Future<void> _toggleClip(TrendingSong song) async {
    final url = song.clipUrl?.trim();
    if (url == null || url.isEmpty) return;

    if (_playingId == song.id && _clipPlayer.playing) {
      await _clipPlayer.pause();
      if (mounted) setState(() => _playingId = null);
      return;
    }

    if (_playingId == song.id && !_clipPlayer.playing) {
      await _clipPlayer.play();
      if (mounted) setState(() => _playingId = song.id);
      return;
    }

    try {
      await _clipPlayer.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await _clipPlayer.seek(Duration.zero);
      await _clipPlayer.play();
      if (mounted) setState(() => _playingId = song.id);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not play this clip.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final data = widget.data;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const DimensionSectionTitle(
                    prefix: 'Trending ',
                    accent: 'now',
                    accentIsPink: true,
                    fontSize: 20,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'The songs the people are voting up right now. Tap play to hear a clip.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: widget.onGetStarted,
              child: const Text('See all'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 210,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: data.songs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final song = data.songs[index];
              final playable =
                  song.clipUrl != null && song.clipUrl!.trim().isNotEmpty;
              final isPlaying = _isPlaying(song);
              return SizedBox(
                width: 148,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AspectRatio(
                      aspectRatio: 1,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (song.artworkUrl != null &&
                                song.artworkUrl!.isNotEmpty)
                              CachedNetworkImage(
                                imageUrl: song.artworkUrl!,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) =>
                                    _ArtworkFallback(title: song.title),
                              )
                            else
                              _ArtworkFallback(title: song.title),
                            Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: playable ? () => _toggleClip(song) : null,
                                child: AnimatedOpacity(
                                  duration: const Duration(milliseconds: 150),
                                  opacity: isPlaying || playable ? 1 : 0.5,
                                  child: Container(
                                    color: isPlaying
                                        ? Colors.black45
                                        : Colors.black26,
                                    alignment: Alignment.center,
                                    child: Container(
                                      width: 44,
                                      height: 44,
                                      decoration: BoxDecoration(
                                        color: cs.surface,
                                        shape: BoxShape.circle,
                                        boxShadow: const [
                                          BoxShadow(
                                            blurRadius: 8,
                                            color: Colors.black26,
                                          ),
                                        ],
                                      ),
                                      child: Icon(
                                        isPlaying
                                            ? Icons.pause_rounded
                                            : Icons.play_arrow_rounded,
                                        color: playable
                                            ? cs.primary
                                            : cs.onSurface.withValues(
                                                alpha: 0.38,
                                              ),
                                        size: 28,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              top: 8,
                              right: 8,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  '🔥 ${song.temperaturePercent}°',
                                  style: TextStyle(
                                    color: _tempColor(song.temperaturePercent),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      song.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      song.artistName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                    ),
                    Text(
                      '🎧 ${_formatTrendingCount(song.listens > 0 ? song.listens : song.earsReached)} listens · '
                      '♥ ${_formatTrendingCount(song.likeCount)}',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: cs.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        if (data.artists.isNotEmpty) ...[
          const SizedBox(height: 28),
          const DimensionSectionTitle(
            prefix: 'Trending ',
            accent: 'artists',
            fontSize: 20,
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 130,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: data.artists.length,
              separatorBuilder: (_, __) => const SizedBox(width: 16),
              itemBuilder: (context, index) {
                final artist = data.artists[index];
                return SizedBox(
                  width: 96,
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 40,
                        backgroundColor: cs.primary.withValues(alpha: 0.12),
                        backgroundImage:
                            artist.avatarUrl != null &&
                                    artist.avatarUrl!.isNotEmpty
                                ? CachedNetworkImageProvider(artist.avatarUrl!)
                                : null,
                        child: artist.avatarUrl == null ||
                                artist.avatarUrl!.isEmpty
                            ? Text(
                                artist.displayName.isNotEmpty
                                    ? artist.displayName[0].toUpperCase()
                                    : '?',
                                style: theme.textTheme.headlineSmall?.copyWith(
                                  color: cs.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        artist.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '🎧 ${_formatTrendingCount(artist.listens > 0 ? artist.listens : artist.earsReached)} listens · '
                        '♥ ${_formatTrendingCount(artist.likeCount)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _ArtworkFallback extends StatelessWidget {
  const _ArtworkFallback({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            cs.primary.withValues(alpha: 0.35),
            cs.primary.withValues(alpha: 0.08),
          ],
        ),
      ),
      alignment: Alignment.center,
      child: Icon(Icons.music_note, color: cs.primary, size: 40),
    );
  }
}

class _StatsStrip extends StatelessWidget {
  const _StatsStrip({required this.stats});

  final Map<String, dynamic> stats;

  int _val(String key) {
    final v = stats[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    return 0;
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M+';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K+';
    return n.toString();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final items = <List<String>>[
      [_fmt(_val('totalUsers')), 'Members'],
      [_fmt(_val('totalSongs')), 'Songs'],
      [_fmt(_val('totalLikes')), 'Ripples'],
      [_fmt(_val('totalListenCount')), 'Listens'],
      [_fmt(_val('liveListeners')), 'Live Listeners'],
      [_fmt(_val('earsReached')), 'Ears Reached'],
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.6,
      children: items
          .map(
            (it) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    it[0],
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: cs.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    it[1],
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _ValueProp {
  const _ValueProp(this.icon, this.title, this.description);
  final IconData icon;
  final String title;
  final String description;
}

const List<_ValueProp> _valueProps = [
  _ValueProp(
    Icons.radio,
    'Always-on radio',
    'A live, democratic station where the people decide what rises.',
  ),
  _ValueProp(
    Icons.videocam_outlined,
    'Livestreams',
    'Go live, perform, and stand shoulder-to-shoulder with your fans.',
  ),
  _ValueProp(
    Icons.favorite_outline,
    'Votes & Ripples',
    'Every like carries an artist a little further across the network.',
  ),
  _ValueProp(
    Icons.insights_outlined,
    'Transparent analytics',
    'The Wake shows your real reach, engagement, and growth.',
  ),
  _ValueProp(
    Icons.handshake_outlined,
    'ProNetworx mentorship',
    'Connect with Catalysts — producers, photographers, and mentors.',
  ),
];

class _GlossaryItem {
  const _GlossaryItem(this.term, this.definition);
  final String term;
  final String definition;
}

class _GlossaryGroupData {
  const _GlossaryGroupData(this.system, this.tagline, this.terms);
  final String system;
  final String tagline;
  final List<_GlossaryItem> terms;
}

const List<_GlossaryGroupData> _glossary = [
  _GlossaryGroupData(
    'The Butterfly Effect',
    'One small ripple can become a storm.',
    [
      _GlossaryItem('The Butterfly Effect',
          'A single vote or discovery can set off the chain reaction that launches an artist\'s career.'),
      _GlossaryItem('Ripples',
          'The audience\'s votes and likes. Every ripple carries an artist\'s sound a little further.'),
      _GlossaryItem('The Wake',
          'An artist\'s analytics report — the path left behind by a thousand Ripples.'),
    ],
  ),
  _GlossaryGroupData(
    'Metamorphosis',
    'The journey from unseen talent to recognized artist.',
    [
      _GlossaryItem('Metamorphosis',
          'The transformation every artist undergoes — from an unknown upload to a name the people know.'),
      _GlossaryItem('Gem',
          'An artist. A hidden gem, ready to be heard and refined by the community.'),
      _GlossaryItem('Diamond',
          'A Gem refined under pressure — a standout artist the community has voted into the spotlight.'),
      _GlossaryItem('Catalyst',
          'A creative service provider (producer, photographer, mentor) who speeds up the metamorphosis through Pro-Networx.'),
    ],
  ),
  _GlossaryGroupData(
    'Mining',
    'Surfacing value from the live frequency.',
    [
      _GlossaryItem('Mining the Frequency',
          'How value is surfaced from the always-on stream — the people dig through the radio to find what shines.'),
      _GlossaryItem('Prospectors',
          'The listeners. They tune in, send Ripples, and refine raw songs into signal the market can trust.'),
      _GlossaryItem('The Refinery',
          'The portal where Prospectors rank, survey, and comment to refine songs before they break out.'),
      _GlossaryItem('The Yield',
          'A Prospector\'s rewards — steady earnings from verified engagement like refinement, surveys, and feedback.'),
    ],
  ),
];

class _GlossaryGroup extends StatelessWidget {
  const _GlossaryGroup({required this.group});

  final _GlossaryGroupData group;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            group.system,
            style: DimensionTypography.accentCyan(fontSize: 16),
          ),
          const SizedBox(height: 2),
          Text(
            group.tagline,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 10),
          ...group.terms.map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: RichText(
                text: TextSpan(
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: cs.onSurfaceVariant,
                    height: 1.5,
                  ),
                  children: [
                    TextSpan(
                      text: '${t.term}: ',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(text: t.definition),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
