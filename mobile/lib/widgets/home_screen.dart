import 'dart:async';

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
import '../core/services/push_notification_service.dart';
import 'dimension/dimension_radio_bar.dart';
import 'dimension/cyber_backdrop.dart';
import 'dimension/dimension_nav_drawer.dart';
import '../core/theme/dimension_tokens.dart';
import '../core/models/user.dart' as app_user;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentIndex = 0;
  app_user.User? _user;

  @override
  void initState() {
    super.initState();
    _loadUserProfile();
    // Ask for push permission once the first home frame is up — right after
    // download + first login — so iOS/Android can deliver radio alerts.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_promptPushPermission());
    });
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

  Future<void> _promptPushPermission() async {
    // Brief delay so login navigation / splash finish before the dialog.
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    await PushNotificationService().promptOnFirstLogin(context);
  }

  void _openNavDrawer() => _scaffoldKey.currentState?.openDrawer();

  Future<void> _signOut() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await auth.signOut();
    } catch (_) {}
    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    // Determine which navigation items to show based on user role.
    final isArtist = _user?.role == 'artist';
    final isAdmin = _user?.role == 'admin';
    final isStreamerRole = _user?.role == 'artist' ||
        _user?.role == 'service_provider' ||
        _user?.role == 'dj' ||
        _user?.role == 'musician' ||
        isAdmin;

    final maxTab = isArtist ? 4 : 3;
    final safeIndex = _currentIndex.clamp(0, maxTab);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: DimensionTokens.bgBase,
      drawer: DimensionNavDrawer(
        user: _user,
        isArtist: isArtist,
        isAdmin: isAdmin,
        isStreamerRole: isStreamerRole,
        currentTabIndex: safeIndex,
        onSelectTab: (index) {
          setState(() => _currentIndex = index.clamp(0, maxTab));
        },
        onOpenRoute: (route, [arguments]) =>
            Navigator.pushNamed(context, route, arguments: arguments),
        onSignOut: _signOut,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: CyberBackdrop()),
          IndexedStack(
            index: safeIndex,
            children: isArtist
                ? [
                    PlayerScreen(onOpenNavDrawer: _openNavDrawer),
                    SocialFeedScreen(onOpenNavDrawer: _openNavDrawer),
                    DiscoveryScreen(onOpenNavDrawer: _openNavDrawer),
                    StudioScreen(onOpenNavDrawer: _openNavDrawer),
                    ProNetworxShellScreen(
                      onExitToRadio: () => setState(() => _currentIndex = 0),
                    ),
                  ]
                : [
                    PlayerScreen(onOpenNavDrawer: _openNavDrawer),
                    SocialFeedScreen(onOpenNavDrawer: _openNavDrawer),
                    DiscoveryScreen(onOpenNavDrawer: _openNavDrawer),
                    CompetitionScreen(onOpenNavDrawer: _openNavDrawer),
                  ],
          ),
        ],
      ),
      // Persistent radio mini-bar (navigation now lives in the left drawer).
      // Skip it on the Radio tab (has the full player) and the artist
      // Pro-Networx tab (hosts its own player).
      bottomNavigationBar:
          (safeIndex != 0 && !(isArtist && safeIndex == 4))
              ? const DimensionRadioBar()
              : null,
    );
  }
}
