import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../features/player/player_screen.dart';
import '../features/discovery/discovery_screen.dart';
import '../features/competition/competition_screen.dart';
import '../features/room/room_screen.dart';
import '../features/studio/studio_screen.dart';
import '../features/about/about_screen.dart';
import '../features/analytics/analytics_screen.dart';
import '../features/messages/messages_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/credits/credits_screen.dart';
import '../features/pro_networx/pro_directory_screen.dart';
import '../features/pro_networx/pro_me_profile_screen.dart';
import '../features/refinery/refinery_screen.dart';
import '../core/auth/auth_service.dart';
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

    final List<NavigationDestination> destinations = isArtist
        ? const [
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
              label: 'Pro-Network',
            ),
            NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              label: 'Room',
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
              icon: Icon(Icons.explore_outlined),
              label: 'Discovery',
            ),
            NavigationDestination(
              icon: Icon(Icons.how_to_vote_outlined),
              label: 'Vote',
            ),
            NavigationDestination(
              icon: Icon(Icons.forum_outlined),
              label: 'Room',
            ),
            NavigationDestination(
              icon: Icon(Icons.more_horiz),
              label: 'More',
            ),
          ];

    void openMoreSheet() {
      showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (context) {
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.person_outline),
                  title: const Text('Profile'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ProfileScreen()),
                    );
                  },
                ),
                if (isArtist) ...[
                  ListTile(
                    leading: const Icon(Icons.library_music_outlined),
                    title: const Text('Credits'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const CreditsScreen()),
                      );
                    },
                  ),
                ],
                ListTile(
                  leading: const Icon(Icons.mail_outline),
                  title: const Text('Messages'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const MessagesScreen()),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.handshake_outlined),
                  title: const Text('PRO‑NETWORX'),
                  subtitle: const Text('Directory, profiles, and inbox'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ProNetworxDirectoryScreen()),
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Build my PRO‑NETWORX profile'),
                  subtitle: const Text('Skills, availability, headline'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ProNetworxMeProfileScreen()),
                    );
                  },
                ),
                if (!isArtist)
                  ListTile(
                    leading: const Icon(Icons.science_outlined),
                    title: const Text('The Refinery'),
                    subtitle: const Text('Review ores, rank, survey, comment for rewards'),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const RefineryScreen()),
                      );
                    },
                  ),
                ListTile(
                  leading: const Icon(Icons.settings_outlined),
                  title: const Text('Settings'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.pushNamed(context, '/settings');
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('About Networx'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AboutScreen()),
                    );
                  },
                ),
                const SizedBox(height: 8),
              ],
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
            return const StudioScreen();
          case 1:
            return const AnalyticsScreen();
          case 2:
            return const ProNetworxDirectoryScreen();
          case 3:
            return const RoomScreen();
          default:
            return const StudioScreen();
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
            return const RoomScreen();
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        destinations: destinations,
        onDestinationSelected: (index) {
          // More sheet (do not change the selected tab)
          if (index == 4) {
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
    );
  }
}
