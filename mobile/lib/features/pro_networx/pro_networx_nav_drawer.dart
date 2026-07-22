import 'package:flutter/material.dart';

import '../../core/brand/brand_assets.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';

/// Left-hand Pro-Networx drawer mirroring the web [ProNetworxAppShell] sidebar:
/// Home, Discover, Search, Services, Projects, Radio, My profile, plus
/// Back to Radio / About Pro footer actions.
class ProNetworxNavDrawer extends StatelessWidget {
  const ProNetworxNavDrawer({
    super.key,
    required this.currentTabIndex,
    required this.onSelectTab,
    required this.onOpenRoute,
    required this.onBackToRadio,
  });

  /// Active index in the Pro shell [IndexedStack].
  final int currentTabIndex;

  final ValueChanged<int> onSelectTab;
  final void Function(String route) onOpenRoute;
  final VoidCallback onBackToRadio;

  static const tabLabels = <String>[
    'Home',
    'Discover',
    'Search',
    'Services',
    'Projects',
    'Radio',
  ];

  static const _tabs = <_ProNavTab>[
    _ProNavTab(icon: Icons.home_outlined, label: 'Home'),
    _ProNavTab(icon: Icons.explore_outlined, label: 'Discover'),
    _ProNavTab(icon: Icons.search, label: 'Search'),
    _ProNavTab(icon: Icons.work_outline, label: 'Services'),
    _ProNavTab(icon: Icons.assignment_outlined, label: 'Projects'),
    _ProNavTab(icon: Icons.radio, label: 'Radio'),
  ];

  void _selectTab(BuildContext context, int index) {
    Navigator.of(context).pop();
    onSelectTab(index);
  }

  void _openRoute(BuildContext context, String route) {
    Navigator.of(context).pop();
    onOpenRoute(route);
  }

  void _backToRadio(BuildContext context) {
    Navigator.of(context).pop();
    onBackToRadio();
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 300,
      backgroundColor: const Color(0xFF08080A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: DimensionTokens.neonCyan.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Image.asset(
                      BrandAssets.logoCyanAsset,
                      fit: BoxFit.contain,
                      errorBuilder: (_, _, _) => const Icon(
                        Icons.graphic_eq,
                        color: DimensionTokens.neonCyan,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'PRO-NETWORX',
                    style: TextStyle(
                      color: DimensionTokens.cyan300,
                      fontSize: 11,
                      letterSpacing: 3,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                children: [
                  for (var i = 0; i < _tabs.length; i++)
                    _ProNavRow(
                      icon: _tabs[i].icon,
                      label: _tabs[i].label,
                      active: currentTabIndex == i,
                      onTap: () => _selectTab(context, i),
                    ),
                  _ProNavRow(
                    icon: Icons.person_outline,
                    label: 'My profile',
                    active: false,
                    onTap: () => _openRoute(context, AppRoutes.proMeProfile),
                  ),
                  const SizedBox(height: 8),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  _ProNavRow(
                    icon: Icons.mail_outline,
                    label: 'Messages',
                    active: false,
                    onTap: () => _openRoute(context, AppRoutes.messages),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                children: [
                  _ProNavRow(
                    icon: Icons.arrow_back,
                    label: 'Back to Radio',
                    active: false,
                    muted: true,
                    onTap: () => _backToRadio(context),
                  ),
                  _ProNavRow(
                    icon: Icons.info_outline,
                    label: 'About Pro',
                    active: false,
                    muted: true,
                    onTap: () =>
                        _openRoute(context, AppRoutes.proNetworxLanding),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProNavTab {
  const _ProNavTab({required this.icon, required this.label});
  final IconData icon;
  final String label;
}

class _ProNavRow extends StatelessWidget {
  const _ProNavRow({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.muted = false,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final fg = active
        ? Colors.black
        : muted
            ? Colors.white.withValues(alpha: 0.55)
            : Colors.white.withValues(alpha: 0.85);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: active ? DimensionTokens.neonCyan : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(icon, size: 18, color: fg),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1.6,
                      fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                      color: fg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
