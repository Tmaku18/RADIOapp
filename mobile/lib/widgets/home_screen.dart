import 'dart:async';
import 'dart:ui';

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
import '../core/services/radio_background_sync_service.dart';
import '../core/services/location_permission_service.dart';
import '../core/services/app_tutorial_service.dart';
import '../features/tutorial/app_tutorial.dart';
import '../features/home/coach_tips.dart';
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

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Tab under the radio sheet. The radio player is not one of these pages.
  int _currentIndex = 0;
  app_user.User? _user;
  bool _tutorialInFlight = false;
  bool _playerEverOpened = false;
  bool _restoredForSheet = false;
  bool _sheetCovers = false;
  bool _radioHighlighted = false;
  bool _sheetDragging = false;
  bool _sheetPulling = false;
  double _sheetGestureDy = 0;
  late final AnimationController _playerSheet;

  static const int _tabRadio = 1;
  static const int _tabFeed = 2;
  static const int _tabDiscover = 3;

  @override
  void initState() {
    super.initState();
    _playerSheet = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    )..addListener(_onPlayerSheetTick);
    HomeTabIntent.selectTab = _selectTab;
    AppTutorialService.instance.requestShow.addListener(
      _onTutorialReplayRequested,
    );
    _loadUserProfile();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthService>(context, listen: false);
      if (auth.currentUser == null) return;
      unawaited(_promptLaunchPermissions());
    });
  }

  @override
  void dispose() {
    _playerSheet.dispose();
    AppTutorialService.instance.requestShow.removeListener(
      _onTutorialReplayRequested,
    );
    if (identical(HomeTabIntent.selectTab, _selectTab)) {
      HomeTabIntent.selectTab = null;
    }
    super.dispose();
  }

  void _onPlayerSheetTick() {
    final progress = _playerSheet.value;
    if (progress == 0) _restoredForSheet = false;
    if (progress > 0) _ensureRadioForSheet();
    final covers = progress > 0;
    final opened = progress > 0;
    final highlighted = progress >= 0.5;
    if (!mounted) return;
    if (opened == _playerEverOpened &&
        covers == _sheetCovers &&
        highlighted == _radioHighlighted) {
      return;
    }
    setState(() {
      if (opened) _playerEverOpened = true;
      _sheetCovers = covers;
      _radioHighlighted = highlighted;
    });
  }

  /// Discover may be borrowing the shared player. Opening the sheet puts the
  /// station back, once, after this frame has told Discover to let go.
  void _ensureRadioForSheet() {
    if (_restoredForSheet) return;
    _restoredForSheet = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(RadioBackgroundSyncService.instance.playRadioIfDisplaced());
    });
  }

  void _applySheetDelta(double dy) {
    _sheetGestureDy += dy;
    _sheetPulling = true;
    final height = MediaQuery.sizeOf(context).height;
    if (height <= 0) return;
    final next = (_playerSheet.value - dy / height).clamp(0.0, 1.0);
    if (next > 0 && !_playerEverOpened) {
      setState(() => _playerEverOpened = true);
    }
    _playerSheet.value = next;
  }

  /// Mini-bar drags have to keep that bar mounted through the end of the
  /// gesture. Removing it as the sheet reaches the top cancels the pointer.
  void _applyBarDrag(double dy) {
    _sheetDragging = true;
    _applySheetDelta(dy);
  }

  void _settleSheet(double velocity) {
    final wasDragging = _sheetDragging;
    final wasPulling = _sheetPulling;
    _sheetDragging = false;
    _sheetPulling = false;
    final progress = _playerSheet.value;
    final height = MediaQuery.sizeOf(context).height;
    final netDown = _sheetGestureDy > 12 || velocity > 500;
    final netUp = _sheetGestureDy < -12 || velocity < -500;
    _sheetGestureDy = 0;
    final bool open;
    if (netDown) {
      final pulled = (1 - progress) * height;
      open = velocity < 500 && pulled < 48 && progress > 0.5;
    } else if (netUp) {
      open = velocity < -500 || progress >= 0.18;
    } else {
      open = progress >= 0.5;
    }
    if (open && !_playerEverOpened) {
      setState(() => _playerEverOpened = true);
    } else if (wasDragging || wasPulling) {
      setState(() {});
    }
    _playerSheet.animateTo(open ? 1 : 0, curve: Curves.easeOutCubic);
  }

  void _onTutorialReplayRequested() {
    unawaited(_startAppTutorial(force: true));
  }

  Future<void> _loadUserProfile() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    try {
      final user = await authService.getUserProfile();
      if (!mounted) return;
      setState(() {
        _user = user;
      });
      if (authService.consumeAccountRestoredNotice()) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Welcome back. Signing in restored your account, so it will not be deleted.',
            ),
          ),
        );
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
    if (!mounted) return;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    if (!mounted) return;
    await CoachTips.showOnce(context);
    if (!mounted) return;
    await _startAppTutorial(force: false);
  }

  Future<void> _startAppTutorial({required bool force}) async {
    if (!mounted || _tutorialInFlight || AppTutorial.isShowing) return;
    if (!force) {
      final done = await AppTutorialService.instance.hasCompleted();
      if (done) return;
    }
    // Ensure we have a role for the correct tour track.
    if (_user == null) {
      await _loadUserProfile();
    }
    if (!mounted) return;
    final role = _user?.role;
    final canUpload = hasArtistCapability(role);
    final proNetworxTab = canUpload ? 4 : null;
    final voteTab = canUpload ? null : 4;

    _tutorialInFlight = true;
    try {
      await AppTutorial.show(
        context,
        role: role,
        selectTab: _selectTab,
        openRoute: (route, [arguments]) async {
          if (!mounted) return;
          await Navigator.of(context).pushNamed(route, arguments: arguments);
        },
        popToHome: _popToHomeShell,
        proNetworxTabIndex: proNetworxTab,
        voteTabIndex: voteTab,
      );
    } finally {
      _tutorialInFlight = false;
    }
  }

  /// Pop routes pushed above the home shell (Upload, Studio, etc.).
  Future<void> _popToHomeShell() async {
    if (!mounted) return;
    final nav = Navigator.of(context);
    while (nav.canPop()) {
      nav.pop();
      await Future<void>.delayed(const Duration(milliseconds: 16));
      if (!mounted) return;
    }
  }

  void _openNavDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _openUpload() => Navigator.pushNamed(context, AppRoutes.upload);

  final List<bool> _tabBuilt = [true, false, false, false, false];

  void _selectTab(int index) {
    final prev = _currentIndex.clamp(0, 4);
    final next = index.clamp(0, 4);
    if (next == _tabRadio) {
      if (!_playerEverOpened) {
        setState(() => _playerEverOpened = true);
      }
      _ensureRadioForSheet();
      _playerSheet.animateTo(1, curve: Curves.easeOutCubic);
      return;
    }
    setState(() {
      _currentIndex = next;
      _tabBuilt[next] = true;
    });
    if (_playerSheet.value > 0) {
      _playerSheet.animateTo(0, curve: Curves.easeOutCubic);
    }
    // Discover borrows the radio player for clips. Leaving that tab puts the
    // live station back. Opening Radio does the same via the sheet.
    if (prev == _tabDiscover && next != _tabDiscover) {
      unawaited(RadioBackgroundSyncService.instance.playRadioIfDisplaced());
    }
  }

  Future<void> _signOut() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await auth.signOut();
    } catch (_) {}
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.login, (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final role = _user?.role;
    final canUpload = hasArtistCapability(role);
    final isAdmin = isAdminRole(role);
    final isStreamerRole =
        role == 'artist' ||
        role == 'service_provider' ||
        role == 'dj' ||
        role == 'musician' ||
        isAdmin;

    // Home · Radio · Feed · Discover · (Vote | Pro-Networx)
    final maxTab = 4;
    final safeIndex = _currentIndex.clamp(0, maxTab);
    final proNetworxTab = canUpload ? 4 : null;
    final voteTab = canUpload ? null : 4;

    // Rebuild Dimension chrome when ThemeMode changes (tokens are static).
    DimensionTokens.watch(context);

    final safeBottom = MediaQuery.paddingOf(context).bottom;
    const navHeight = 80.0;
    final navIndex = _radioHighlighted ? _tabRadio : safeIndex;
    // The mini bar is part of the bottom chrome whenever the sheet is down.
    final barInset = navHeight + safeBottom + DimensionTokens.radioBarHeight;

    Widget aboveBar(Widget child) {
      return Padding(
        padding: EdgeInsets.only(bottom: barInset),
        child: child,
      );
    }

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: DimensionTokens.bgBase,
      extendBody: true,
      drawer: DimensionNavDrawer(
        user: _user,
        isArtist: canUpload,
        isAdmin: isAdmin,
        isStreamerRole: isStreamerRole,
        currentTabIndex: navIndex,
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
              TickerMode(
                enabled: safeIndex == 0 && !_sheetCovers,
                child: aboveBar(
                NetworxHomeScreen(
                  onOpenNavDrawer: _openNavDrawer,
                  onOpenRadio: () => _selectTab(_tabRadio),
                  onOpenFeed: () => _selectTab(_tabFeed),
                  onOpenDiscover: () => _selectTab(_tabDiscover),
                  onOpenVote: voteTab != null
                      ? () => _selectTab(voteTab)
                      : () =>
                            Navigator.pushNamed(context, AppRoutes.competition),
                  onOpenProNetworx: proNetworxTab != null
                      ? () => _selectTab(proNetworxTab)
                      : () => Navigator.pushNamed(
                          context,
                          AppRoutes.proNetworxShell,
                        ),
                ),
              ),
              ),
              // Radio is the sheet above this stack, so this slot stays empty
              // and there is only one PlayerScreen.
              const SizedBox.shrink(),
              _tabBuilt[2]
                  ? aboveBar(
                      SocialFeedScreen(
                        onOpenNavDrawer: _openNavDrawer,
                        isActive: safeIndex == _tabFeed && !_sheetCovers,
                      ),
                    )
                  : const SizedBox.shrink(),
              _tabBuilt[3]
                  ? aboveBar(
                      DiscoveryScreen(
                        onOpenNavDrawer: _openNavDrawer,
                        isActive: safeIndex == _tabDiscover && !_sheetCovers,
                      ),
                    )
                  : const SizedBox.shrink(),
              if (!_tabBuilt[4])
                const SizedBox.shrink()
              else if (canUpload)
                aboveBar(
                  ProNetworxShellScreen(
                    onExitToRadio: () => _selectTab(_tabRadio),
                    visible: safeIndex == 4 && !_sheetCovers,
                  ),
                )
              else
                aboveBar(CompetitionScreen(onOpenNavDrawer: _openNavDrawer)),
            ],
          ),
          AnimatedBuilder(
            animation: _playerSheet,
            builder: (context, child) {
              final progress = _playerSheet.value;
              final height = MediaQuery.sizeOf(context).height;
              return IgnorePointer(
                ignoring: progress == 0 && !_sheetPulling,
                child: Transform.translate(
                  offset: Offset(0, (1 - progress) * height),
                  child: child,
                ),
              );
            },
            child: _playerEverOpened
                ? TickerMode(
                    enabled: _sheetCovers,
                    child: PlayerScreen(
                      key: const ValueKey('radio-player-sheet'),
                      onOpenNavDrawer: _openNavDrawer,
                      onUpload: _openUpload,
                      bottomOverlay: navHeight + safeBottom,
                      onSheetDragUpdate: _applySheetDelta,
                      onSheetDragEnd: _settleSheet,
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
      // Mini player sits on the tab bar until the radio sheet is fully open.
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: DimensionTokens.glassStrongBlur,
            sigmaY: DimensionTokens.glassStrongBlur,
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: DimensionTokens.chromeBarColor,
              border: Border(
                top: BorderSide(color: DimensionTokens.glassBorder),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedBuilder(
                  animation: _playerSheet,
                  builder: (context, child) {
                    final progress = _playerSheet.value;
                    if (progress >= 0.98 && !_sheetDragging) {
                      return const SizedBox.shrink();
                    }
                    return Opacity(
                      opacity: (1 - progress).clamp(0.0, 1.0),
                      child: IgnorePointer(
                        ignoring: progress > 0.85,
                        child: child,
                      ),
                    );
                  },
                  child: DimensionRadioBar(
                    onOpenPlayer: () => _selectTab(_tabRadio),
                    onSheetDragUpdate: _applyBarDrag,
                    onSheetDragEnd: _settleSheet,
                    includeBottomInset: false,
                    shareParentGlass: true,
                  ),
                ),
                NavigationBar(
                  backgroundColor: Colors.transparent,
                  elevation: 0,
                  shadowColor: Colors.transparent,
                  surfaceTintColor: Colors.transparent,
                  indicatorColor: Colors.transparent,
                  selectedIndex: navIndex,
                  onDestinationSelected: _selectTab,
                  destinations: [
                    const NavigationDestination(
                      icon: Icon(Icons.home_outlined),
                      selectedIcon: Icon(Icons.home),
                      label: 'Home',
                    ),
                    const NavigationDestination(
                      icon: Icon(Icons.radio_outlined),
                      selectedIcon: Icon(Icons.radio),
                      label: 'Radio',
                    ),
                    const NavigationDestination(
                      icon: Icon(Icons.dynamic_feed_outlined),
                      selectedIcon: Icon(Icons.dynamic_feed),
                      label: 'Feed',
                    ),
                    const NavigationDestination(
                      icon: Icon(Icons.explore_outlined),
                      selectedIcon: Icon(Icons.explore),
                      label: 'Discover',
                    ),
                    NavigationDestination(
                      icon: Icon(
                        canUpload
                            ? Icons.work_outline
                            : Icons.how_to_vote_outlined,
                      ),
                      selectedIcon: Icon(
                        canUpload ? Icons.work : Icons.how_to_vote,
                      ),
                      label: canUpload ? 'Pro' : 'Vote',
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
