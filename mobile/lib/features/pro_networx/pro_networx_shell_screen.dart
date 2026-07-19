import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_radio_bar.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'pro_home_feed_screen.dart';
import 'pro_radio_screen.dart';
import 'pro_search_screen.dart';
import 'pro_services_screen.dart';

/// Authenticated Pro-Networx app shell. Hosts 4 tabs (Home / Search / Services
/// / Radio) plus a "My profile" action and the persistent radio mini-bar so
/// audio keeps playing while users browse.
class ProNetworxShellScreen extends StatefulWidget {
  const ProNetworxShellScreen({super.key, this.initialTab = 0});
  final int initialTab;

  @override
  State<ProNetworxShellScreen> createState() => _ProNetworxShellScreenState();
}

class _ProNetworxShellScreenState extends State<ProNetworxShellScreen> {
  late int _index = widget.initialTab.clamp(0, 3);

  static const _tabs = <_ProTab>[
    _ProTab(label: 'Home', icon: Icons.home_outlined),
    _ProTab(label: 'Search', icon: Icons.search),
    _ProTab(label: 'Services', icon: Icons.work_outline),
    _ProTab(label: 'Radio', icon: Icons.radio),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: DimensionTokens.bgBase,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('Pro-Networx'),
        actions: [
          const BackToNetworxRadioButton(
            compact: true,
            authenticatedTarget: true,
          ),
          IconButton(
            tooltip: 'My profile',
            icon: const Icon(Icons.person_outline),
            onPressed: () => Navigator.of(context).pushNamed(
              AppRoutes.proMeProfile,
            ),
          ),
          IconButton(
            tooltip: 'Messages',
            icon: const Icon(Icons.mail_outline),
            onPressed: () => Navigator.of(context).pushNamed(
              AppRoutes.messages,
            ),
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
                    ProSearchScreen(),
                    ProServicesScreen(),
                    ProRadioScreen(),
                  ],
                ),
              ),
              const DimensionRadioBar(),
            ],
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: _tabs
            .map(
              (t) =>
                  NavigationDestination(icon: Icon(t.icon), label: t.label),
            )
            .toList(),
      ),
    );
  }
}

class _ProTab {
  const _ProTab({required this.label, required this.icon});
  final String label;
  final IconData icon;
}
