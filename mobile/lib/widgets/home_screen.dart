import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/navigation/app_routes.dart';
import '../core/auth/role_helpers.dart';
import '../features/player/player_screen.dart';
import '../features/discovery/discovery_screen.dart';
import '../features/social/social_feed_screen.dart';
import '../features/competition/competition_screen.dart';
import '../features/dashboard/gem_dashboard_screen.dart';
import '../features/pro_networx/pro_networx_shell_screen.dart';
import '../core/auth/auth_service.dart';
import '../core/services/push_notification_service.dart';
import '../core/services/location_permission_service.dart';
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_promptLaunchPermissions());
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

  Future<void> _promptLaunchPermissions() async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    await PushNotificationService().promptOnFirstLogin(context);
    if (!mounted) return;
    // After notifications, ask for GPS so Nearby People can use location.
    await Future<void>.delayed(const Duration(milliseconds: 400));
    if (!mounted) return;
    await LocationPermissionService.instance.promptOnLaunch(context);
  }

  void _openNavDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _openUpload() => Navigator.pushNamed(context, AppRoutes.upload);

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
    final role = _user?.role;
    final canUpload = hasArtistCapability(role);
    final isAdmin = isAdminRole(role);
    final isStreamerRole = role == 'artist' ||
        role == 'service_provider' ||
        role == 'dj' ||
        role == 'musician' ||
        isAdmin;

    // Gem / Catalyst / Admin: Radio · Feed · Discover · Dashboard · Pro-Networx
    // Everyone else: Radio · Feed · Discover · Vote
    final maxTab = canUpload ? 4 : 3;
    final safeIndex = _currentIndex.clamp(0, maxTab);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: DimensionTokens.bgBase,
      drawer: DimensionNavDrawer(
        user: _user,
        isArtist: canUpload,
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
            children: canUpload
                ? [
                    PlayerScreen(
                      onOpenNavDrawer: _openNavDrawer,
                      onUpload: _openUpload,
                    ),
                    SocialFeedScreen(onOpenNavDrawer: _openNavDrawer),
                    DiscoveryScreen(onOpenNavDrawer: _openNavDrawer),
                    GemDashboardScreen(onOpenNavDrawer: _openNavDrawer),
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
      bottomNavigationBar:
          (safeIndex != 0 && !(canUpload && safeIndex == 4))
              ? const DimensionRadioBar()
              : null,
    );
  }
}
