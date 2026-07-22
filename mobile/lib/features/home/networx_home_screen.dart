import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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
  int _discoveries = 0;

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
        _discoveries = asInt(
          stats['totalProfileClicks'] ?? stats['total_profile_clicks'],
        );
      });
    } catch (_) {
      // Best-effort; keep zeros.
    } finally {
      if (mounted) setState(() => _loadingStats = false);
    }
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
          'Messages',
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
        'Messages',
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
            title: Text(
              'Networx Home',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
            ),
            actions: [
              const NotificationsBellButton(),
              if (hasArtistCapability(role))
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilledButton.icon(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.upload),
                    icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                    label: const Text('Upload'),
                    style: FilledButton.styleFrom(
                      backgroundColor: DimensionTokens.neonCyan,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                  ),
                ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: _loadStats,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                GlassCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        '◤ DASHBOARD · WELCOME BACK',
                        style: GoogleFonts.jetBrainsMono(
                          color: DimensionTokens.neonCyan,
                          fontSize: 10,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text.rich(
                        TextSpan(
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.w900,
                            fontSize: 28,
                            height: 1.05,
                            color: DimensionTokens.textPrimary,
                            letterSpacing: -0.5,
                          ),
                          children: [
                            const TextSpan(text: 'Hey '),
                            TextSpan(
                              text: '$name.',
                              style: const TextStyle(
                                color: DimensionTokens.neonCyan,
                              ),
                            ),
                            const TextSpan(text: '\nMine the frequency.'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _roleHomeSubtitle(role),
                        style: GoogleFonts.outfit(
                          color: DimensionTokens.textSecondary,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: AspectRatio(
                          aspectRatio: 16 / 10,
                          child: Image.asset(
                            'assets/images/branding/welcome-to-the-networx.png',
                            fit: BoxFit.contain,
                            errorBuilder: (_, _, _) => Container(
                              color: Colors.black26,
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.music_note,
                                color: DimensionTokens.neonCyan,
                                size: 48,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (_loadingStats)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.55,
                    children: [
                      _StatTile(
                        label: 'Songs',
                        value: _songs,
                        icon: Icons.headphones,
                        accent: DimensionTokens.pink400,
                      ),
                      _StatTile(
                        label: 'Ears Reached',
                        value: _ears,
                        icon: Icons.favorite_border,
                        accent: DimensionTokens.neonYellow,
                      ),
                      _StatTile(
                        label: 'Listens',
                        value: _listens,
                        icon: Icons.graphic_eq,
                        accent: DimensionTokens.neonCyan,
                      ),
                      _StatTile(
                        label: 'Discoveries',
                        value: _discoveries,
                        icon: Icons.local_fire_department_outlined,
                        accent: DimensionTokens.neonCyan,
                      ),
                    ],
                  ),
                const SizedBox(height: 18),
                Text(
                  'QUICK ACTIONS',
                  style: GoogleFonts.jetBrainsMono(
                    color: DimensionTokens.neonCyan,
                    fontSize: 10,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _roleHomeTitle(role),
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    color: DimensionTokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 10),
                for (final action in actions)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: GlassCard(
                      padding: EdgeInsets.zero,
                      child: ListTile(
                        onTap: action.onTap,
                        leading: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.black.withValues(alpha: 0.55),
                            border: Border.all(
                              color: DimensionTokens.neonCyan
                                  .withValues(alpha: 0.4),
                            ),
                          ),
                          child: Icon(
                            action.icon,
                            color: DimensionTokens.neonCyan,
                            size: 20,
                          ),
                        ),
                        title: Text(
                          action.title,
                          style: GoogleFonts.outfit(
                            fontWeight: FontWeight.w700,
                            color: DimensionTokens.textPrimary,
                          ),
                        ),
                        subtitle: Text(
                          action.desc,
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: DimensionTokens.textMuted,
                          ),
                        ),
                        trailing: const Icon(Icons.chevron_right, size: 20),
                      ),
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

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.55),
              border: Border.all(color: accent.withValues(alpha: 0.45)),
            ),
            child: Icon(icon, color: accent, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  value.toString().replaceAllMapped(
                    RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
                    (m) => '${m[1]},',
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w900,
                    fontSize: 20,
                    color: accent,
                  ),
                ),
                Text(
                  label.toUpperCase(),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 8,
                    letterSpacing: 1.2,
                    color: DimensionTokens.textMuted,
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
