import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/auth/role_helpers.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/analytics_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/notifications_bell_button.dart';

/// Signed-in Networx Home — web `/dashboard` parity (hero, stats, role actions).
class NetworxHomeScreen extends StatefulWidget {
  const NetworxHomeScreen({
    super.key,
    this.onOpenNavDrawer,
    this.onOpenRadio,
    this.onOpenFeed,
    this.onOpenDiscover,
    this.onOpenVote,
    this.onOpenProNetworx,
  });

  final VoidCallback? onOpenNavDrawer;
  final VoidCallback? onOpenRadio;
  final VoidCallback? onOpenFeed;
  final VoidCallback? onOpenDiscover;
  final VoidCallback? onOpenVote;
  final VoidCallback? onOpenProNetworx;

  @override
  State<NetworxHomeScreen> createState() => _NetworxHomeScreenState();
}

class _NetworxHomeScreenState extends State<NetworxHomeScreen> {
  final AnalyticsService _analytics = AnalyticsService();
  bool _loadingStats = true;
  int _songs = 0;
  int _ears = 0;
  int _listens = 0;
  int _likes = 0;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await _analytics.getPlatformStats();
      if (!mounted || stats == null) return;
      int asInt(dynamic v) =>
          v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
      setState(() {
        _songs = asInt(stats['totalSongs'] ?? stats['total_songs']);
        _ears = asInt(stats['earsReached'] ?? stats['ears_reached']);
        _listens = asInt(
          stats['listens'] ??
              stats['totalListenCount'] ??
              stats['total_listen_count'],
        );
        _likes = asInt(
          stats['totalLikes'] ?? stats['total_likes'],
        );
      });
    } catch (_) {
      // Best-effort; keep zeros.
    } finally {
      if (mounted) setState(() => _loadingStats = false);
    }
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  String _roleHomeTitle(String? role) {
    if (role == 'admin') return 'Admin Home';
    if (role == 'service_provider') return 'Producer Home';
    if (hasArtistCapability(role)) return 'Artist Home';
    return 'Listener Home';
  }

  String _roleHomeSubtitle(String? role) {
    if (role == 'admin') {
      return 'Manage songs, users, feed, and platform settings.';
    }
    if (role == 'service_provider') {
      return 'Offer your services to artists and manage your listings.';
    }
    if (hasArtistCapability(role)) {
      return 'Upload music and grow your discoveries.';
    }
    return 'Discover artists, tune in to the radio, and refine songs into signal.';
  }

  List<_HomeAction> _actionsForRole(String? role) {
    final openRadio = widget.onOpenRadio ??
        () => Navigator.pushNamed(context, AppRoutes.player);
    final openDiscover = widget.onOpenDiscover ??
        () => Navigator.pushNamed(context, AppRoutes.discovery);
    final openFeed = widget.onOpenFeed ??
        () => Navigator.pushNamed(context, AppRoutes.home);
    final openVote = widget.onOpenVote ??
        () => Navigator.pushNamed(context, AppRoutes.competition);
    final openPro = widget.onOpenProNetworx ??
        () => Navigator.pushNamed(context, AppRoutes.proNetworxShell);

    if (role == 'admin') {
      return [
        _HomeAction(
          Icons.shield_outlined,
          'Admin Overview',
          'Platform stats and quick actions.',
          () => Navigator.pushNamed(context, AppRoutes.adminDashboard),
        ),
        _HomeAction(
          Icons.radio,
          'Listen',
          'Tune in to the radio.',
          openRadio,
        ),
        _HomeAction(
          Icons.person_outline,
          'Your Profile',
          'View and edit your profile.',
          () => Navigator.pushNamed(context, AppRoutes.profile),
        ),
      ];
    }

    if (role == 'service_provider') {
      return [
        _HomeAction(
          Icons.cloud_upload_outlined,
          'Upload Music',
          'Submit tracks to the radio rotation.',
          () => Navigator.pushNamed(context, AppRoutes.upload),
        ),
        _HomeAction(
          Icons.work_outline,
          'Pro-Networx',
          'Manage your Producer profile and services.',
          openPro,
        ),
        _HomeAction(
          Icons.event_available_outlined,
          'Live Services',
          'Schedule live sessions.',
          () => Navigator.pushNamed(context, AppRoutes.liveServices),
        ),
        _HomeAction(
          Icons.auto_awesome,
          'Discover',
          'Find artists and other producers.',
          openDiscover,
        ),
        _HomeAction(
          Icons.chat_bubble_outline,
          'DMs',
          'Chat with clients.',
          () => Navigator.pushNamed(context, AppRoutes.messages),
        ),
        _HomeAction(
          Icons.person_outline,
          'Your Profile',
          'View and edit your profile.',
          () => Navigator.pushNamed(context, AppRoutes.profile),
        ),
      ];
    }

    if (hasArtistCapability(role)) {
      return [
        _HomeAction(
          Icons.cloud_upload_outlined,
          'Upload Music',
          'Submit tracks to the radio rotation.',
          () => Navigator.pushNamed(context, AppRoutes.upload),
        ),
        _HomeAction(
          Icons.library_music_outlined,
          'My Songs',
          'Manage your songs.',
          () => Navigator.pushNamed(context, AppRoutes.studio),
        ),
        _HomeAction(
          Icons.show_chart,
          'Analytics',
          'Track listens, engagement, and growth.',
          () => Navigator.pushNamed(context, AppRoutes.analytics),
        ),
        _HomeAction(
          Icons.science_outlined,
          'The Refinery',
          'Get an in-depth review of your song.',
          () => Navigator.pushNamed(context, AppRoutes.refinery),
        ),
        _HomeAction(
          Icons.headphones,
          'Listen',
          'Tune in to the radio.',
          openRadio,
        ),
        _HomeAction(
          Icons.event_available_outlined,
          'Live Services',
          'Schedule and manage live events.',
          () => Navigator.pushNamed(context, AppRoutes.liveServices),
        ),
        _HomeAction(
          Icons.work_outline,
          'Pro-Networx',
          'Find and offer creative services.',
          openPro,
        ),
        _HomeAction(
          Icons.redeem_outlined,
          'Rewards',
          'Track rewards and redeem at thresholds.',
          () => Navigator.pushNamed(context, AppRoutes.yield),
        ),
        _HomeAction(
          Icons.person_outline,
          'Your Profile',
          'View and edit your profile.',
          () => Navigator.pushNamed(context, AppRoutes.profile),
        ),
      ];
    }

    // Listener / Prospector
    return [
      _HomeAction(
        Icons.cloud_upload_outlined,
        'Upload Music',
        'Join Trial by Fire to become an Artist and submit tracks.',
        () => Navigator.pushNamed(context, AppRoutes.upload),
      ),
      _HomeAction(
        Icons.radio,
        'Listen Now',
        'Tune in to the radio stream.',
        openRadio,
      ),
      _HomeAction(
        Icons.auto_awesome,
        'Discover',
        'Find underground talent and Catalysts.',
        openDiscover,
      ),
      _HomeAction(
        Icons.emoji_events_outlined,
        'Competition',
        'Leaderboards, diamonds, and Top 7.',
        openVote,
      ),
      _HomeAction(
        Icons.people_alt_outlined,
        'Feed',
        'See what’s happening on the network.',
        openFeed,
      ),
      _HomeAction(
        Icons.chat_bubble_outline,
        'DMs',
        'Chat with gems and creators.',
        () => Navigator.pushNamed(context, AppRoutes.messages),
      ),
      _HomeAction(
        Icons.science_outlined,
        'The Refinery',
        'Sign up as a reviewer and earn rewards.',
        () => Navigator.pushNamed(context, AppRoutes.refinery),
      ),
      _HomeAction(
        Icons.redeem_outlined,
        'Rewards',
        'Track rewards and redeem at thresholds.',
        () => Navigator.pushNamed(context, AppRoutes.yield),
      ),
      _HomeAction(
        Icons.person_outline,
        'Your Profile',
        'View and edit your profile.',
        () => Navigator.pushNamed(context, AppRoutes.profile),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    // DimensionTokens are static — depend on Theme so light/dark applies now.
    DimensionTokens.watch(context);
    final auth = Provider.of<AuthService>(context, listen: false);

    return FutureBuilder(
      future: auth.getUserProfile(),
      builder: (context, snapshot) {
        final user = snapshot.data;
        final role = user?.role;
        final name = (user?.displayName?.trim().isNotEmpty ?? false)
            ? user!.displayName!.trim()
            : 'Prospector';
        final actions = _actionsForRole(role);

        return Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            leading: widget.onOpenNavDrawer != null
                ? IconButton(
                    icon: const Icon(Icons.menu),
                    tooltip: 'Menu',
                    onPressed: widget.onOpenNavDrawer,
                  )
                : null,
            title: const Text('Home'),
            actions: [
              const NotificationsBellButton(),
              IconButton(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.upload),
                tooltip: 'Upload',
                icon: const Icon(Icons.cloud_upload_outlined),
              ),
              const SizedBox(width: 4),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: _loadStats,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
              children: [
                // A large greeting in place of the card-in-a-card hero: an
                // eyebrow label, a two-tone slogan, a subtitle and a marketing
                // banner all stacked inside a bordered panel.
                Text(
                  _greeting(),
                  style: TextStyle(
                    fontSize: 15,
                    color: DimensionTokens.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  name,
                  style: DimensionTypography.pageTitle(fontSize: 32),
                ),
                const SizedBox(height: 6),
                Text(
                  _roleHomeSubtitle(role),
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.4,
                    color: DimensionTokens.textSecondary,
                  ),
                ),
                const SizedBox(height: 20),
                if (_loadingStats)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else
                  // One card, four figures. Four separate tiles each with its
                  // own circular badge in its own accent colour turned basic
                  // counts into the loudest thing on the screen.
                  GlassCard(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      children: [
                        _Stat(label: 'Songs', value: _songs),
                        _StatDivider(),
                        _Stat(label: 'Listens', value: _listens),
                        _StatDivider(),
                        _Stat(label: 'Ears', value: _ears),
                        _StatDivider(),
                        _Stat(label: 'Likes', value: _likes),
                      ],
                    ),
                  ),
                DimensionSectionHeader(title: _roleHomeTitle(role)),
                // A single grouped list, the way iOS settings and Apple Music's
                // library present a set of destinations.
                GlassCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (var i = 0; i < actions.length; i++) ...[
                        if (i > 0)
                          Padding(
                            padding: const EdgeInsets.only(left: 56),
                            child: Divider(
                              height: 0.5,
                              color: DimensionTokens.glassBorder,
                            ),
                          ),
                        ListTile(
                          onTap: actions[i].onTap,
                          contentPadding:
                              const EdgeInsets.symmetric(horizontal: 16),
                          leading: Icon(
                            actions[i].icon,
                            color: DimensionTokens.neonCyan,
                            size: 24,
                          ),
                          title: Text(
                            actions[i].title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          subtitle: Text(
                            actions[i].desc,
                            style: TextStyle(
                              fontSize: 13,
                              color: DimensionTokens.textSecondary,
                            ),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            size: 20,
                            color: DimensionTokens.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HomeAction {
  const _HomeAction(this.icon, this.title, this.desc, this.onTap);
  final IconData icon;
  final String title;
  final String desc;
  final VoidCallback onTap;
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final int value;

  static final _thousands = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value.toString().replaceAllMapped(_thousands, (m) => '${m[1]},'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DimensionTypography.statValue(fontSize: 22),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: DimensionTokens.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 0.5,
      height: 28,
      color: DimensionTokens.glassBorder,
    );
  }
}
