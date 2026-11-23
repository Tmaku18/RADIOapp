import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/auth/role_helpers.dart';
import '../../core/models/user.dart' as app_user;
import '../../core/navigation/app_routes.dart';
import '../../core/services/analytics_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/notifications_bell_button.dart';
import '../player/widgets/butterfly_swarm_backdrop.dart';

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
  bool _showPersonal = false;
  String? _statsRole;
  int _personalSongs = 0;
  int _personalListens = 0;
  int _personalEars = 0;
  int _personalLikes = 0;
  int _platformSongs = 0;
  int _platformListens = 0;
  int _platformEars = 0;
  int _platformLikes = 0;
  int _platformArtists = 0;
  int _platformUsers = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadStats());
  }

  bool _isFallbackProfile(app_user.User? profile) {
    if (profile == null) return true;
    // A timed-out profile is a Firebase-only listener, not the real account.
    return profile.role == 'listener' &&
        profile.id.isNotEmpty &&
        profile.id == profile.firebaseUid;
  }

  bool _wantsPersonalStats(String? role, List<String> roles) {
    if (role == 'admin') return true;
    if (role != null && makerRoleOrder.contains(role)) return true;
    return roles.any(makerRoleOrder.contains);
  }

  Future<void> _loadStats() async {
    int asInt(dynamic v) =>
        v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;
    String? role = _statsRole;
    List<String> makerRoles = const [];
    Map<String, dynamic>? stats;
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final results = await Future.wait([
        auth.getUserProfile(),
        _analytics.getPlatformStats(),
      ]);
      var profile = results[0] as app_user.User?;
      stats = results[1] as Map<String, dynamic>?;
      if (_isFallbackProfile(profile)) {
        await auth.refreshIdToken();
        profile = await auth.getUserProfile(force: true);
      }
      if (!_isFallbackProfile(profile)) {
        role = profile?.role ?? role;
        makerRoles = profile?.userRoles ?? const [];
      }
    } catch (_) {
      try {
        stats = await _analytics.getPlatformStats();
      } catch (_) {
        stats = null;
      }
    }
    if (!mounted) return;
    var personalSongs = _personalSongs;
    var personalListens = _personalListens;
    var personalEars = _personalEars;
    var personalLikes = _personalLikes;
    if (_wantsPersonalStats(role, makerRoles)) {
      Future<void> applyMine() async {
        final mine = await _analytics.getMyAnalytics();
        personalSongs = mine?.totalSongs ?? 0;
        personalListens = mine?.totalListenCount ?? 0;
        personalEars = mine?.earsReached ?? 0;
        personalLikes = mine?.totalLikes ?? 0;
      }

      try {
        await applyMine();
      } catch (_) {
        try {
          if (!mounted) return;
          await auth.refreshIdToken();
          await applyMine();
        } catch (_) {
          // Personal numbers stay at the last good value.
        }
      }
    }
    if (!mounted) return;
    setState(() {
      _statsRole = role;
      _showPersonal = _wantsPersonalStats(role, makerRoles);
      _personalSongs = personalSongs;
      _personalListens = personalListens;
      _personalEars = personalEars;
      _personalLikes = personalLikes;
      if (stats != null) {
        _platformSongs = asInt(stats['totalSongs'] ?? stats['total_songs']);
        _platformEars = asInt(stats['earsReached'] ?? stats['ears_reached']);
        _platformListens = asInt(
          stats['listens'] ??
              stats['totalListenCount'] ??
              stats['total_listen_count'],
        );
        _platformLikes = asInt(stats['totalLikes'] ?? stats['total_likes']);
        _platformArtists = asInt(
          stats['totalArtists'] ?? stats['total_artists'],
        );
        _platformUsers = asInt(stats['totalUsers'] ?? stats['total_users']);
      }
      _loadingStats = false;
    });
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
      return 'Upload music and grow your live listeners.';
    }
    return 'Discover artists, tune in to the radio, and refine songs into signal.';
  }

  List<_HomeAction> _actionsForRole(String? role) {
    final openRadio =
        widget.onOpenRadio ??
        () => Navigator.pushNamed(context, AppRoutes.player);
    final openDiscover =
        widget.onOpenDiscover ??
        () => Navigator.pushNamed(context, AppRoutes.discovery);
    final openFeed =
        widget.onOpenFeed ?? () => Navigator.pushNamed(context, AppRoutes.home);
    final openVote =
        widget.onOpenVote ??
        () => Navigator.pushNamed(context, AppRoutes.competition);
    final openPro =
        widget.onOpenProNetworx ??
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
          Icons.show_chart,
          'Analytics',
          'Track ears reached, listens, and growth.',
          () => Navigator.pushNamed(context, AppRoutes.analytics),
        ),
        _HomeAction(Icons.radio, 'Listen', 'Tune in to the radio.', openRadio),
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
          Icons.show_chart,
          'Analytics',
          'Track ears reached, listens, and growth.',
          () => Navigator.pushNamed(context, AppRoutes.analytics),
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
      future: auth.getUserProfile(), // cached; rebuilds do not refetch
      builder: (context, snapshot) {
        final user = snapshot.data;
        final role = user?.role;
        final name = (user?.displayName?.trim().isNotEmpty ?? false)
            ? user!.displayName!.trim()
            : 'Prospector';
        final actions = _actionsForRole(role);

        return Stack(
          fit: StackFit.expand,
          children: [
            const Positioned.fill(
              child: IgnorePointer(
                child: ButterflySwarmBackdrop(butterflyCount: 22),
              ),
            ),
            Scaffold(
              backgroundColor: Colors.transparent,
              extendBodyBehindAppBar: true,
              appBar: AppBar(
                backgroundColor: Colors.transparent,
                foregroundColor: Colors.white,
                elevation: 0,
                scrolledUnderElevation: 0,
                leading: widget.onOpenNavDrawer != null
                    ? IconButton(
                        icon: const Icon(Icons.menu),
                        tooltip: 'Menu',
                        onPressed: widget.onOpenNavDrawer,
                      )
                    : null,
                title: const Text(
                  'Home',
                  style: TextStyle(color: Colors.white),
                ),
                actions: [
                  IconButton(
                    tooltip: 'Search',
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.search),
                    icon: const Icon(Icons.search),
                  ),
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
                  padding: EdgeInsets.fromLTRB(
                    16,
                    MediaQuery.paddingOf(context).top + kToolbarHeight,
                    16,
                    32,
                  ),
                  children: [
                    // A large greeting in place of the card-in-a-card hero: an
                    // eyebrow label, a two-tone slogan, a subtitle and a marketing
                    // banner all stacked inside a bordered panel.
                    Text(
                      _greeting(),
                      style: const TextStyle(
                        fontSize: 15,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      name,
                      style: DimensionTypography.pageTitle(
                        fontSize: 32,
                      ).copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _roleHomeSubtitle(role),
                      style: const TextStyle(
                        fontSize: 15,
                        height: 1.4,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const _WelcomeBanner(),
                    const SizedBox(height: 20),
                    if (_loadingStats)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else
                      ..._statBars(),
                    DimensionSectionHeader(
                      title: _roleHomeTitle(role),
                      color: Colors.white,
                    ),
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
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
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
            ),
          ],
        );
      },
    );
  }

  List<Widget> _statBars() {
    final yours = _statRow([
      ('Songs', _personalSongs),
      ('Listens', _personalListens),
      ('Ears', _personalEars),
      ('Likes', _personalLikes),
    ]);
    final platformOriginal = _statRow([
      ('Songs', _platformSongs),
      ('Listens', _platformListens),
      ('Ears', _platformEars),
      ('Likes', _platformLikes),
    ]);
    final platformTotals = _statRow([
      ('Songs', _platformSongs),
      ('Artists', _platformArtists),
      ('Users', _platformUsers),
      ('Listens', _platformListens),
    ]);
    if (_statsRole == 'admin') {
      return [
        _statCaption('Platform'),
        platformOriginal,
        const SizedBox(height: 14),
        _statCaption('Your stats'),
        yours,
      ];
    }
    if (_showPersonal) {
      return [
        _statCaption('Your stats'),
        yours,
        const SizedBox(height: 14),
        _statCaption('Platform'),
        platformTotals,
      ];
    }
    return [platformOriginal];
  }

  Widget _statCaption(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 6),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          letterSpacing: 1.2,
          color: Colors.white54,
        ),
      ),
    );
  }

  Widget _statRow(List<(String, int)> items) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) _StatDivider(),
            _Stat(label: items[i].$1, value: items[i].$2),
          ],
        ],
      ),
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

/// The "Welcome to the Networx" cast illustration.
///
/// 3:2 matches the artwork exactly, so `cover` fills the card without
/// cropping anyone out or letterboxing the sides.
class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner();

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(DimensionTokens.cardRadius),
      child: AspectRatio(
        aspectRatio: 3 / 2,
        child: Image.asset(
          'assets/images/branding/welcome-to-the-networx.png',
          fit: BoxFit.cover,
          cacheWidth: 960,
          errorBuilder: (_, _, _) => ColoredBox(
            color: DimensionTokens.bgSurface,
            child: Center(
              child: Icon(
                Icons.music_note,
                color: DimensionTokens.textMuted,
                size: 40,
              ),
            ),
          ),
        ),
      ),
    );
  }
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
