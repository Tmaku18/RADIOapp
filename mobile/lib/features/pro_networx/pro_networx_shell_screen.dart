import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../features/job_board/job_board_screen.dart';
import '../../features/social/social_feed_screen.dart';
import '../../widgets/dimension/dimension_radio_bar.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'pro_home_feed_screen.dart';
import 'pro_networx_nav_drawer.dart';
import 'pro_radio_screen.dart';
import 'pro_search_screen.dart';
import 'pro_services_screen.dart';

/// Authenticated Pro-Networx app shell — side menu parity with web
/// [ProNetworxAppShell] (Home / Discover / Search / Services / Projects /
/// Radio / My profile), plus the persistent radio mini-bar.
class ProNetworxShellScreen extends StatefulWidget {
  const ProNetworxShellScreen({
    super.key,
    this.initialTab = 0,
    this.onExitToRadio,
  });
  final int initialTab;

  /// When hosted as an inline tab (artists), the parent passes this to switch
  /// back to the Networx Radio player tab. When null (pushed as its own route
  /// for listeners), the shell pops / resets to home instead.
  final VoidCallback? onExitToRadio;

  static const int tabHome = 0;
  static const int tabDiscover = 1;
  static const int tabSearch = 2;
  static const int tabServices = 3;
  static const int tabProjects = 4;
  static const int tabRadio = 5;
  static const int tabCount = 6;

  @override
  State<ProNetworxShellScreen> createState() => _ProNetworxShellScreenState();
}

class _ProNetworxShellScreenState extends State<ProNetworxShellScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  late int _index =
      widget.initialTab.clamp(0, ProNetworxShellScreen.tabCount - 1);

  String get _sectionLabel {
    final tabs = ProNetworxNavDrawer.tabLabels;
    if (_index >= 0 && _index < tabs.length) return tabs[_index];
    return 'Pro-Networx';
  }

  void _exitToRadio() {
    final onExit = widget.onExitToRadio;
    if (onExit != null) {
      onExit();
      return;
    }
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
      return;
    }
    navigator.pushNamedAndRemoveUntil(AppRoutes.home, (route) => false);
  }

  void _openDrawer() => _scaffoldKey.currentState?.openDrawer();

  void _selectTab(int index) {
    setState(() => _index = index.clamp(0, ProNetworxShellScreen.tabCount - 1));
  }

  void _openRoute(String route) {
    Navigator.of(context).pushNamed(route);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: DimensionTokens.bgBase,
      drawer: ProNetworxNavDrawer(
        currentTabIndex: _index,
        onSelectTab: _selectTab,
        onOpenRoute: _openRoute,
        onBackToRadio: _exitToRadio,
      ),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          tooltip: 'Menu',
          icon: const Icon(Icons.menu),
          onPressed: _openDrawer,
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'NETWORX / PRO-NETWORX',
              style: TextStyle(
                color: DimensionTokens.cyan300.withValues(alpha: 0.85),
                fontSize: 9,
                letterSpacing: 2.2,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              _sectionLabel.toUpperCase(),
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
          ],
        ),
        actions: [
          BackToNetworxRadioButton(
            compact: true,
            authenticatedTarget: true,
            onPressed: _exitToRadio,
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: CyberBackdrop()),
          Column(
            children: [
              Expanded(
                child: IndexedStack(
                  index: _index,
                  children: const [
                    ProHomeFeedScreen(),
                    SocialFeedScreen(embeddedInProShell: true),
                    ProSearchScreen(),
                    ProServicesScreen(),
                    JobBoardScreen(embedded: true),
                    ProRadioScreen(),
                  ],
                ),
              ),
              const DimensionRadioBar(),
            ],
          ),
        ],
      ),
    );
  }
}
