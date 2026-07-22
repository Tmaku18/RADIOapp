import 'package:flutter/material.dart';

import '../../core/models/user.dart' as app_user;
import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';

/// Left-hand navigation drawer that mirrors the web app's Dimension sidebar
/// (logo header, role-based pill nav items in the same order, collapsible
/// More / Account / Admin sections, and a user footer with Sign out).
///
/// Selecting a primary item either switches one of the home shell's tabs
/// ([onSelectTab]) or pushes a named route ([onOpenRoute]); the drawer closes
/// itself first in both cases.
class DimensionNavDrawer extends StatefulWidget {
  const DimensionNavDrawer({
    super.key,
    required this.user,
    required this.isArtist,
    this.showUpload = false,
    required this.isAdmin,
    required this.isStreamerRole,
    required this.currentTabIndex,
    required this.onSelectTab,
    required this.onOpenRoute,
    required this.onSignOut,
  });

  final app_user.User? user;
  final bool isArtist;
  /// When true, Upload appears even for listeners (gated by ApplyScreen).
  final bool showUpload;
  final bool isAdmin;
  final bool isStreamerRole;

  /// Active tab index in the home [IndexedStack] (for highlighting).
  final int currentTabIndex;

  /// Switch the home shell to the given tab index.
  final ValueChanged<int> onSelectTab;

  /// Push a named route from [AppRoutes] (optional [arguments] for tab indexes).
  final void Function(String route, [Object? arguments]) onOpenRoute;

  final VoidCallback onSignOut;

  @override
  State<DimensionNavDrawer> createState() => _DimensionNavDrawerState();
}

class _DimensionNavDrawerState extends State<DimensionNavDrawer> {
  bool _moreOpen = false;
  bool _accountOpen = false;
  bool _adminOpen = false;

  void _selectTab(int index) {
    Navigator.of(context).pop();
    widget.onSelectTab(index);
  }

  void _openRoute(String route, [Object? arguments]) {
    Navigator.of(context).pop();
    widget.onOpenRoute(route, arguments);
  }

  List<_NavSpec> get _primaryItems {
    final proNetworx = widget.isArtist
        ? const _NavSpec(
            icon: Icons.work_outline,
            label: 'Pro-Networx',
            tabIndex: 4,
          )
        : const _NavSpec(
            icon: Icons.handshake_outlined,
            label: 'Pro-Networx',
            route: AppRoutes.proNetworxShell,
          );

    return [
      // Post-sign-in landing (web `/dashboard`). Logo card also opens this.
      const _NavSpec(
        icon: Icons.home_outlined,
        label: 'Networx Home',
        tabIndex: 0,
      ),
      // Kept at the top — opens the radio player (do not remove/replace).
      const _NavSpec(icon: Icons.radio, label: 'Radio', tabIndex: 1),
      const _NavSpec(
        icon: Icons.headphones,
        label: 'Live DJ',
        route: AppRoutes.liveDj,
      ),
      const _NavSpec(
        icon: Icons.mic_external_on,
        label: 'Live Performances',
        route: AppRoutes.livePerformances,
      ),
      const _NavSpec(
        icon: Icons.public,
        label: 'Nearby People',
        route: AppRoutes.nearbyPeople,
      ),
      // Web `/browse/saved` — song library tab inside Discover (not Pro posts).
      const _NavSpec(
        icon: Icons.library_music_outlined,
        label: 'Library',
        route: AppRoutes.discovery,
        routeArgs: 3,
      ),
      const _NavSpec(
        icon: Icons.people_alt_outlined,
        label: 'Feed',
        tabIndex: 2,
      ),
      const _NavSpec(
        icon: Icons.notifications_outlined,
        label: 'Notifications',
        route: AppRoutes.notifications,
      ),
      const _NavSpec(
        icon: Icons.local_fire_department_outlined,
        label: 'Discover',
        tabIndex: 3,
      ),
      if (widget.isArtist)
        // Same hub as Networx Home (web dashboard).
        const _NavSpec(
          icon: Icons.dashboard_outlined,
          label: 'Dashboard',
          tabIndex: 0,
        )
      else
        const _NavSpec(
          icon: Icons.how_to_vote_outlined,
          label: 'Vote',
          tabIndex: 4,
        ),
      if (widget.isArtist || widget.showUpload)
        const _NavSpec(
          icon: Icons.cloud_upload_outlined,
          label: 'Upload',
          route: AppRoutes.upload,
        ),
      if (widget.isArtist) ...[
        const _NavSpec(
          icon: Icons.library_music_outlined,
          label: 'My Songs',
          route: AppRoutes.studio,
        ),
        const _NavSpec(
          icon: Icons.show_chart,
          label: 'Analytics',
          route: AppRoutes.analytics,
        ),
      ],
      const _NavSpec(
        icon: Icons.science_outlined,
        label: 'The Refinery',
        route: AppRoutes.refinery,
      ),
      proNetworx,
      const _NavSpec(
        icon: Icons.redeem_outlined,
        label: 'Rewards',
        route: AppRoutes.yield,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 300,
      backgroundColor: DimensionTokens.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.only(
          topRight: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            _LogoCard(onTap: () => _selectTab(0)),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
                children: [
                  for (final item in _primaryItems)
                    _NavRow(
                      icon: item.icon,
                      label: item.label,
                      active: item.tabIndex != null &&
                          item.tabIndex == widget.currentTabIndex,
                      onTap: () {
                        if (item.tabIndex != null) {
                          _selectTab(item.tabIndex!);
                        } else if (item.route != null) {
                          _openRoute(item.route!, item.routeArgs);
                        }
                      },
                    ),
                  const SizedBox(height: 6),
                  const Divider(height: 1),
                  const SizedBox(height: 6),
                  _CollapsibleSection(
                    title: 'More',
                    icon: Icons.more_horiz,
                    open: _moreOpen,
                    onToggle: () => setState(() => _moreOpen = !_moreOpen),
                    children: [
                      _subRow('The Chat Room', AppRoutes.room),
                      _subRow('Pro Directory', AppRoutes.proDirectory),
                      _subRow('Job Board', AppRoutes.jobBoard),
                      _subRow(
                        'Build PRO-NETWORX profile',
                        AppRoutes.proMeProfile,
                      ),
                      if (widget.isArtist) ...[
                        _subRow('Credits', AppRoutes.credits),
                      ],
                      if (widget.isStreamerRole) ...[
                        _subRow('Stream settings', AppRoutes.streamSettings),
                        _subRow('Live services', AppRoutes.liveServices),
                      ],
                    ],
                  ),
                  _CollapsibleSection(
                    title: 'Account & settings',
                    icon: Icons.person_outline,
                    open: _accountOpen,
                    onToggle: () =>
                        setState(() => _accountOpen = !_accountOpen),
                    children: [
                      _subRow('Profile', AppRoutes.profile),
                      _subRow('Messages', AppRoutes.messages),
                      _subRow('Notifications', AppRoutes.notifications),
                      _subRow('Settings', AppRoutes.settings),
                      _subRow('About Networx', AppRoutes.about),
                    ],
                  ),
                  if (widget.isAdmin)
                    _CollapsibleSection(
                      title: 'Admin',
                      icon: Icons.shield_outlined,
                      open: _adminOpen,
                      onToggle: () =>
                          setState(() => _adminOpen = !_adminOpen),
                      children: [
                        _subRow('Admin Dashboard', AppRoutes.adminDashboard),
                      ],
                    ),
                ],
              ),
            ),
            _UserFooter(
              user: widget.user,
              isArtist: widget.isArtist,
              isAdmin: widget.isAdmin,
              onOpenProfile: () => _openRoute(AppRoutes.profile),
              onSignOut: () {
                Navigator.of(context).pop();
                widget.onSignOut();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _subRow(String label, String route) {
    return _NavSubRow(label: label, onTap: () => _openRoute(route));
  }
}

class _NavSpec {
  const _NavSpec({
    required this.icon,
    required this.label,
    this.tabIndex,
    this.route,
    this.routeArgs,
  });

  final IconData icon;
  final String label;
  final int? tabIndex;
  final String? route;
  final Object? routeArgs;
}

class _LogoCard extends StatelessWidget {
  const _LogoCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: DimensionTokens.neonCyan.withValues(alpha: 0.2),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: DimensionTokens.neonCyan.withValues(alpha: 0.4),
                  ),
                  boxShadow: DimensionTokens.glowCyan(spread: 10),
                ),
                child: Icon(
                  Icons.graphic_eq,
                  color: DimensionTokens.neonCyan,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'NETWORX',
                    style: TextStyle(
                      color: DimensionTokens.textPrimary,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Text(
                    'RADIO',
                    style: TextStyle(
                      color: DimensionTokens.cyan300.withValues(alpha: 0.8),
                      fontSize: 9,
                      letterSpacing: 4,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  const _NavRow({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: active
            ? DimensionTokens.neonCyan.withValues(alpha: 0.10)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: active
                    ? DimensionTokens.neonCyan.withValues(alpha: 0.30)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: active
                        ? DimensionTokens.neonCyan
                        : DimensionTokens.textPrimary.withValues(alpha: 0.04),
                    border: active
                        ? null
                        : Border.all(
                            color: DimensionTokens.glassBorder,
                          ),
                  ),
                  child: Icon(
                    icon,
                    size: 18,
                    color: active
                        ? (DimensionTokens.isDark
                            ? Colors.black
                            : Colors.white)
                        : DimensionTokens.cyan300,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      color: active
                          ? DimensionTokens.textPrimary
                          : DimensionTokens.textSecondary,
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

class _NavSubRow extends StatelessWidget {
  const _NavSubRow({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(48, 8, 12, 8),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            color: DimensionTokens.textMuted,
          ),
        ),
      ),
    );
  }
}

class _CollapsibleSection extends StatelessWidget {
  const _CollapsibleSection({
    required this.title,
    required this.icon,
    required this.open,
    required this.onToggle,
    required this.children,
  });

  final String title;
  final IconData icon;
  final bool open;
  final VoidCallback onToggle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onToggle,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: DimensionTokens.textPrimary.withValues(alpha: 0.04),
                    border: Border.all(
                      color: DimensionTokens.glassBorder,
                    ),
                  ),
                  child: Icon(icon, size: 18, color: DimensionTokens.cyan300),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      color: DimensionTokens.textSecondary,
                    ),
                  ),
                ),
                AnimatedRotation(
                  turns: open ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: Icon(
                    Icons.keyboard_arrow_down,
                    size: 20,
                    color: DimensionTokens.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (open) ...children,
      ],
    );
  }
}

class _UserFooter extends StatelessWidget {
  const _UserFooter({
    required this.user,
    required this.isArtist,
    required this.isAdmin,
    required this.onOpenProfile,
    required this.onSignOut,
  });

  final app_user.User? user;
  final bool isArtist;
  final bool isAdmin;
  final VoidCallback onOpenProfile;
  final VoidCallback onSignOut;

  String get _roleLabel {
    if (isAdmin) return 'ADMIN';
    final role = user?.role;
    if (role == 'service_provider') return 'PRODUCER';
    if (role == 'dj') return 'DJ';
    if (role == 'musician') return 'MUSICIAN';
    if (isArtist || role == 'artist') return 'ARTIST';
    return 'LISTENER';
  }

  @override
  Widget build(BuildContext context) {
    final name = (user?.displayName?.trim().isNotEmpty ?? false)
        ? user!.displayName!.trim()
        : (user?.email ?? 'Account');
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';
    final avatarUrl = user?.avatarUrl;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: DimensionTokens.glassBorder),
        ),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onOpenProfile,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: DimensionTokens.bgBase.withValues(
                      alpha: DimensionTokens.isDark ? 0.6 : 0.9,
                    ),
                    backgroundImage:
                        (avatarUrl != null && avatarUrl.isNotEmpty)
                            ? NetworkImage(avatarUrl)
                            : null,
                    child: (avatarUrl == null || avatarUrl.isEmpty)
                        ? Text(
                            initial,
                            style: TextStyle(
                              color: DimensionTokens.cyan300,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: DimensionTokens.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          _roleLabel,
                          style: TextStyle(
                            color: DimensionTokens.cyan300,
                            fontSize: 9,
                            letterSpacing: 2,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          InkWell(
            borderRadius: BorderRadius.circular(999),
            onTap: onSignOut,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: DimensionTokens.textPrimary.withValues(alpha: 0.04),
                      border: Border.all(
                        color: DimensionTokens.glassBorder,
                      ),
                    ),
                    child: Icon(
                      Icons.logout,
                      size: 18,
                      color: DimensionTokens.pink400,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Sign out',
                    style: TextStyle(
                      fontSize: 14,
                      color: DimensionTokens.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
