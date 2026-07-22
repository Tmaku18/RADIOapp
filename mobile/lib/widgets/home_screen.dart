import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/navigation/app_routes.dart';
import '../core/navigation/home_tab_intent.dart';
import '../core/auth/role_helpers.dart';
import '../features/home/networx_home_screen.dart';
import '../features/player/player_screen.dart';
import '../features/discovery/discovery_screen.dart';
import '../features/social/social_feed_screen.dart';
import '../features/competition/competition_screen.dart';
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
  /// 0 = Networx Home (post-sign-in landing). Radio player is index 1.
  int _currentIndex = 0;
  app_user.User? _user;

  static const int _tabRadio = 1;
  static const int _tabFeed = 2;
  static const int _tabDiscover = 3;

  @override
  void initState() {
    super.initState();
    HomeTabIntent.selectTab = _selectTab;
    _loadUserProfile();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_promptLaunchPermissions());
    });
  }

  @override
  void dispose() {
    if (identical(HomeTabIntent.selectTab, _selectTab)) {
      HomeTabIntent.selectTab = null;
    }
    super.dispose();
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
    // Re-sync FCM token every launch so pushes keep working after reinstalls.
    await PushNotificationService().ensureRegisteredAfterAuth();
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

  void _selectTab(int index) {
    setState(() => _currentIndex = index.clamp(0, 4));
  }

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

    // Home · Radio · Feed · Discover · (Vote | Pro-Networx)
    final maxTab = 4;
    final safeIndex = _currentIndex.clamp(0, maxTab);
    final proNetworxTab = canUpload ? 4 : null;
    final voteTab = canUpload ? null : 4;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: DimensionTokens.bgBase,
      drawer: DimensionNavDrawer(
        user: _user,
        isArtist: canUpload,
        // Upload is always in the drawer; listeners hit Trial by Fire gate.
        showUpload: true,
        isAdmin: isAdmin,
        isStreamerRole: isStreamerRole,
        currentTabIndex: safeIndex,
        onSelectTab: _selectTab,
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
            children: [
              NetworxHomeScreen(
                onOpenNavDrawer: _openNavDrawer,
                onOpenRadio: () => _selectTab(_tabRadio),
                onOpenFeed: () => _selectTab(_tabFeed),
                onOpenDiscover: () => _selectTab(_tabDiscover),
                onOpenVote: voteTab != null
                    ? () => _selectTab(voteTab)
                    : () => Navigator.pushNamed(
                          context,
                          AppRoutes.competition,
                        ),
                onOpenProNetworx: proNetworxTab != null
                    ? () => _selectTab(proNetworxTab)
                    : () => Navigator.pushNamed(
                          context,
                          AppRoutes.proNetworxShell,
                        ),
              ),
              PlayerScreen(
                onOpenNavDrawer: _openNavDrawer,
                onUpload: _openUpload,
              ),
              SocialFeedScreen(onOpenNavDrawer: _openNavDrawer),
              DiscoveryScreen(onOpenNavDrawer: _openNavDrawer),
              if (canUpload)
                ProNetworxShellScreen(
                  onExitToRadio: () => _selectTab(_tabRadio),
                )
              else
                CompetitionScreen(onOpenNavDrawer: _openNavDrawer),
            ],
          ),
        ],
      ),
      // Mini player when not already on the Radio tab or Pro-Networx shell.
      bottomNavigationBar:
          (safeIndex != _tabRadio && !(canUpload && safeIndex == 4))
              ? const DimensionRadioBar()
              : null,
    );
  }
}
