import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/navigation/app_routes.dart';
import '../features/player/player_screen.dart';
import '../features/discovery/discovery_screen.dart';
import '../features/competition/competition_screen.dart';
import '../features/studio/studio_screen.dart';
import '../features/analytics/analytics_screen.dart';
import '../features/pro_networx/pro_directory_screen.dart';
import '../features/refinery/refinery_screen.dart';
import '../features/yield/yield_screen.dart';
import '../core/auth/auth_service.dart';
import 'mini_player_bar.dart';
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
  bool _isLoading = true;

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
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Determine which navigation items to show based on user role
    final isArtist = _user?.role == 'artist';
    final isStreamerRole = _user?.role == 'artist' || _user?.role == 'service_provider';

    final List<NavigationDestination> destinations = isArtist
        ? const [
            NavigationDestination(
              icon: Icon(Icons.radio),
              label: 'Radio',
            ),
            NavigationDestination(
              icon: Icon(Icons.people_alt_outlined),
              label: 'Social',
            ),
            NavigationDestination(
              icon: Icon(Icons.mic),
              label: 'Studio',
            ),
            NavigationDestination(
              icon: Icon(Icons.show_chart),
              label: 'Analytics',
            ),
            NavigationDestination(
              icon: Icon(Icons.work_outline),
              label: 'Pro-Networx',
            ),
            NavigationDestination(
              icon: Icon(Icons.redeem_outlined),
              label: 'Rewards',
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
              label: 'Social',
            ),
            NavigationDestination(
              icon: Icon(Icons.how_to_vote_outlined),
              label: 'Vote',
            ),
            NavigationDestination(
              icon: Icon(Icons.science_outlined),
              label: 'Refinery',
            ),
            NavigationDestination(
              icon: Icon(Icons.redeem_outlined),
              label: 'Rewards',
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
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const Text('Profile'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.profile);
                  },
                ),
                if (isArtist) ...[
                  ListTile(
                    leading: const Icon(Icons.library_music_outlined),
                    title: const Text('Credits'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.credits);
                    },
                  ),
                ],
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
                ListTile(
                  leading: const Icon(Icons.forum_outlined),
                  title: const Text('Room'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.room);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.handshake_outlined),
                  title: const Text('Pro-Networx'),
                  subtitle: const Text('Directory, profiles, and inbox'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.proDirectory);
                  },
                ),
                if (isArtist)
                  ListTile(
                    leading: const Icon(Icons.work_history_outlined),
                    title: const Text('Job Board'),
                    subtitle: const Text('Browse and apply to service requests'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.jobBoard);
                    },
                  ),
                if (!isArtist)
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
                  title: const Text('Build my Pro-Networx profile'),
                  subtitle: const Text('Skills, availability, headline'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, AppRoutes.proMeProfile);
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
                if (!isArtist)
                  ListTile(
                    leading: const Icon(Icons.redeem_outlined),
                    title: const Text('Rewards'),
                    subtitle: const Text(r'Rewards Command Center ($5 / $10 Virtual Visa)'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.pushNamed(context, AppRoutes.yield);
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

    // Map indices based on role
    Widget getCurrentScreen() {
      if (isArtist) {
        switch (_currentIndex) {
          case 0:
            return const PlayerScreen();
          case 1:
            return const DiscoveryScreen();
          case 2:
            return const StudioScreen();
          case 3:
            return const AnalyticsScreen();
          case 4:
            return const ProNetworxDirectoryScreen();
          case 5:
            return const YieldScreen();
          default:
            return const PlayerScreen();
        }
      } else {
        switch (_currentIndex) {
          case 0:
            return const PlayerScreen();
          case 1:
            return const DiscoveryScreen();
          case 2:
            return const CompetitionScreen();
          case 3:
            return const RefineryScreen();
          case 4:
            return const YieldScreen();
          default:
            return const PlayerScreen();
        }
      }
    }

    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Scaffold(
      body: getCurrentScreen(),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_currentIndex != 0) const MiniPlayerBar(),
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
