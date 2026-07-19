import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/navigation/app_routes.dart';
import '../features/player/player_screen.dart';
import '../features/discovery/discovery_screen.dart';
import '../features/social/social_feed_screen.dart';
import '../features/competition/competition_screen.dart';
import '../features/studio/studio_screen.dart';
import '../features/pro_networx/pro_networx_shell_screen.dart';
import '../core/auth/auth_service.dart';
import 'dimension/dimension_radio_bar.dart';
import 'dimension/cyber_backdrop.dart';
import '../core/theme/dimension_tokens.dart';
import '../core/models/user.dart' as app_user;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  int _lastRealIndex = 0;
  app_user.User? _user;

  @override
  void initState() {
    super.initState();
    _loadUserProfile();
  }

  Future<void> _loadUserProfile() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      final user = await authService.getUserProfile();
      if (mounted) {
        setState(() {
          _user = user;
        });
      }
    } catch (_) {
      // Keep default navigation; profile can load later from other screens.
    }
  }

  Widget _sheetSectionHeader(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              letterSpacing: 0.8,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
            ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Determine which navigation items to show based on user role
    final isArtist = _user?.role == 'artist';
    final isAdmin = _user?.role == 'admin';
    final isStreamerRole = _user?.role == 'artist' ||
        _user?.role == 'service_provider' ||
        _user?.role == 'dj' ||
        _user?.role == 'musician' ||
        isAdmin;

    final List<NavigationDestination> destinations = isArtist
        ? const [
            NavigationDestination(
              icon: Icon(Icons.radio),
              label: 'Radio',
            ),
            NavigationDestination(
              icon: Icon(Icons.people_alt_outlined),
              label: 'Feed',
            ),
            NavigationDestination(
              icon: Icon(Icons.local_fire_department_outlined),
              label: 'Discover',
            ),
            NavigationDestination(
              icon: Icon(Icons.mic),
              label: 'My Songs',
            ),
            NavigationDestination(
              icon: Icon(Icons.work_outline),
              label: 'Pro-Networx',
            ),
            NavigationDestination(
              icon: Icon(Icons.more_horiz),
              label: 'More',
            ),
          ]
        : const [
            NavigationDestination(
              icon: Icon(Icons.radio),
              label: 'Radio',
            ),
            NavigationDestination(
              icon: Icon(Icons.people_alt_outlined),
              label: 'Feed',
            ),
            NavigationDestination(
              icon: Icon(Icons.local_fire_department_outlined),
              label: 'Discover',
            ),
            NavigationDestination(
              icon: Icon(Icons.how_to_vote_outlined),
              label: 'Competition',
            ),
            NavigationDestination(
              icon: Icon(Icons.handshake_outlined),
              label: 'Pro-Networx',
            ),
            NavigationDestination(
              icon: Icon(Icons.more_horiz),
              label: 'More',
            ),
          ];

    void openMoreSheet() {
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) {
          final maxHeight = MediaQuery.of(context).size.height * 0.85;
          return SafeArea(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: maxHeight),
              child: ListView(
                shrinkWrap: true,
                children: [
                _sheetSectionHeader(context, 'Explore'),
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const Text('Profile'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.profile);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.handshake_outlined),
                  title: const Text('Pro-Networx'),
                  subtitle: const Text('Network, hire, post, and message'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.proNetworxShell);
                  },
                ),
                if (!isArtist)
                  ListTile(
                    leading: const Icon(Icons.science_outlined),
                    title: const Text('Refinery'),
                    subtitle: const Text('Review songs, rank, survey, comment for rewards'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.refinery);
                    },
                  ),
                ListTile(
                  leading: const Icon(Icons.sensors),
                  title: const Text('Live'),
                  subtitle: const Text('Watch artists streaming now'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.liveSessions);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.mic_external_on),
                  title: const Text('Live Performances'),
                  subtitle: const Text('Watch a musician performing live'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.livePerformances);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.headphones),
                  title: const Text('Live DJ'),
                  subtitle: const Text('Tune into a DJ broadcasting live'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.liveDj);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.forum_outlined),
                  title: const Text('Room'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.room);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.groups_outlined),
                  title: const Text('Pro Directory'),
                  subtitle: const Text('Browse Catalysts by skill and location'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.proDirectory);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.work_history_outlined),
                  title: const Text('Job Board'),
                  subtitle: const Text('Exclusive service requests and collaborations'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.jobBoard);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.place_outlined),
                  title: const Text('Nearby People'),
                  subtitle: const Text('Discover Catalysts (service providers) near you'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.nearbyPeople);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Build your PRO-NETWORX profile'),
                  subtitle: const Text('Skills, availability, headline'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.proMeProfile);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.redeem_outlined),
                  title: const Text('Rewards'),
                  subtitle: const Text(r'Rewards Command Center ($5 / $10 / $25 Virtual Visa)'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.yield);
                  },
                ),
                if (isArtist) ...[
                  ListTile(
                    leading: const Icon(Icons.show_chart),
                    title: const Text('Analytics'),
                    subtitle: const Text('Listens, likes, audience insights'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.analytics);
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.library_music_outlined),
                    title: const Text('Credits'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.credits);
                    },
                  ),
                ],
                const Divider(height: 1),
                _sheetSectionHeader(context, 'Account & settings'),
                ListTile(
                  leading: const Icon(Icons.mail_outline),
                  title: const Text('Messages'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.messages);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: const Text('Notifications'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.notifications);
                  },
                ),
                if (isStreamerRole)
                  ListTile(
                    leading: const Icon(Icons.live_tv),
                    title: const Text('Stream settings'),
                    subtitle: const Text('Request access, go live, manage stream'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.streamSettings);
                    },
                  ),
                if (isStreamerRole)
                  ListTile(
                    leading: const Icon(Icons.event_available_outlined),
                    title: const Text('Live services'),
                    subtitle: const Text('Promote gigs and contact support'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.liveServices);
                    },
                  ),
                ListTile(
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text('Settings'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.settings);
                  },
                ),
                if (isAdmin)
                  ListTile(
                    leading: const Icon(Icons.admin_panel_settings_outlined),
                    title: const Text('Admin Dashboard'),
                    subtitle: const Text('Full in-app admin controls'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.adminDashboard);
                    },
                  ),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('About Networx'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.about);
                  },
                ),
                const SizedBox(height: 8),
              ],
              ),
            ),
          );
        },
      );
    }

    // Map indices based on role — bodies live in [IndexedStack] below.
    return Scaffold(
      backgroundColor: DimensionTokens.bgBase,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: CyberBackdrop()),
          IndexedStack(
            index: _currentIndex.clamp(0, isArtist ? 4 : 3),
            children: isArtist
                ? [
                    const PlayerScreen(),
                    const SocialFeedScreen(),
                    const DiscoveryScreen(),
                    const StudioScreen(),
                    ProNetworxShellScreen(
                      onExitToRadio: () => setState(() {
                        _currentIndex = 0;
                        _lastRealIndex = 0;
                      }),
                    ),
                  ]
                : const [
                    PlayerScreen(),
                    SocialFeedScreen(),
                    DiscoveryScreen(),
                    CompetitionScreen(),
                  ],
          ),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Radio mini-bar for every tab except the player itself. The
          // Pro-Networx tab (artist index 4) hosts its own player, so skip it
          // here to avoid two stacked radio bars.
          if (_currentIndex != 0 && !(isArtist && _currentIndex == 4))
            const DimensionRadioBar(),
          NavigationBar(
            selectedIndex: _currentIndex,
            destinations: destinations,
            onDestinationSelected: (index) {
              final moreTabIndex = destinations.length - 1;
              // More sheet (do not change the selected tab)
              if (index == moreTabIndex) {
                openMoreSheet();
                setState(() => _currentIndex = _lastRealIndex);
                return;
              }
              // Listener Pro-Networx button (index 4) navigates like the menu entry
              // instead of switching to an inline tab.
              if (!isArtist && index == 4) {
                Navigator.pushNamed(context, AppRoutes.proNetworxShell);
                setState(() => _currentIndex = _lastRealIndex);
                return;
              }
              setState(() {
                _currentIndex = index;
                _lastRealIndex = index;
              });
            },
          ),
        ],
      ),
    );
  }
}
