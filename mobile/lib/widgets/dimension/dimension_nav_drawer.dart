import 'package:flutter/material.dart';

import '../../core/models/user.dart' as app_user;
import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../features/invite/invite_friends_sheet.dart';

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
    required this.isAdmin,
    required this.isStreamerRole,
    required this.currentTabIndex,
    required this.onSelectTab,
    required this.onOpenRoute,
    required this.onSignOut,
  });

  final app_user.User? user;
  final bool isArtist;
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
      // Directly under Radio to match the web sidebar order.
      const _NavSpec(
        icon: Icons.queue_music_outlined,
        label: 'Pro-Radio',
        route: AppRoutes.proRadio,
      ),
      const _NavSpec(
        icon: Icons.forum_outlined,
        label: 'The Chat Room',
        route: AppRoutes.room,
      ),
      // Directly under The Chat Room; the song Library lives inside its shell.
      proNetworx,
      const _NavSpec(
        icon: Icons.chat_bubble_outline,
        label: 'DMs',
        route: AppRoutes.messages,
      ),
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
      const _NavSpec(
        icon: Icons.people_alt_outlined,
        label: 'Feed',
        tabIndex: 2,
      ),
      const _NavSpec(
        icon: Icons.local_fire_department_outlined,
        label: 'Discover',
        tabIndex: 3,
      ),
      if (!widget.isArtist)
        const _NavSpec(
          icon: Icons.how_to_vote_outlined,
          label: 'Vote',
          tabIndex: 4,
        ),
      // Upload lives inside My Songs (studio) now.
      const _NavSpec(
        icon: Icons.library_music_outlined,
        label: 'My Songs',
        route: AppRoutes.studio,
      ),
      const _NavSpec(
        icon: Icons.science_outlined,
        label: 'The Refinery',
        route: AppRoutes.refinery,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    return Drawer(
      width: 300,
      backgroundColor: DimensionTokens.bgSurface,
      shape: const RoundedRectangleBorder(),
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
                          _openRoute(item.route!);
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
                      _subRow('Rewards', AppRoutes.yield),
                      if (widget.isArtist)
                        _subRow('Analytics', AppRoutes.analytics),
                      _subRow('Pro Directory', AppRoutes.proDirectory),
                      _subRow('Job Board', AppRoutes.jobBoard),
                      _subRow(
                        'Build PRO-NETWORX profile',
                        AppRoutes.proMeProfile,
                      ),
                      if (widget.isArtist) ...[
                        _subRow('Placements', AppRoutes.credits),
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
                      _subRow('DMs', AppRoutes.messages),
                      _subRow('Notifications', AppRoutes.notifications),
                      _actionRow('Invite friends', _openInvite),
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
                        _subRow('DJ Booth', AppRoutes.adminDjBooth),
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

  /// A row that runs an action instead of navigating.
  Widget _actionRow(String label, VoidCallback onTap) {
    return _NavSubRow(label: label, onTap: onTap);
  }

  void _openInvite() {
    // Close the drawer first, then present from the navigator's context — this
    // widget is gone by the time the sheet opens.
    final navigator = Navigator.of(context);
    navigator.pop();
    InviteFriendsSheet.show(navigator.context);
  }
}

class _NavSpec {
  const _NavSpec({
    required this.icon,
    required this.label,
    this.tabIndex,
    this.route,
  });

  final IconData icon;
  final String label;
  final int? tabIndex;
  final String? route;
}

class _LogoCard extends StatelessWidget {
  const _LogoCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              Icon(
                Icons.graphic_eq,
                color: DimensionTokens.neonCyan,
                size: 26,
              ),
              const SizedBox(width: 12),
              Text(
                'Networx Radio',
                style: TextStyle(
                  color: DimensionTokens.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 20,
                  letterSpacing: -0.4,
                ),
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
    // Plain glyph and label. Every row used to carry a 36px circled icon, so a
    // fourteen-item sidebar read as fourteen buttons rather than a list.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Material(
        color: active
            ? DimensionTokens.neonCyan.withValues(alpha: 0.12)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: active
                      ? DimensionTokens.neonCyan
                      : DimensionTokens.textSecondary,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      color: active
                          ? DimensionTokens.neonCyan
                          : DimensionTokens.textPrimary,
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
        padding: const EdgeInsets.fromLTRB(48, 10, 12, 10),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 15,
            color: DimensionTokens.textSecondary,
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
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(icon, size: 22, color: DimensionTokens.textSecondary),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      color: DimensionTokens.textPrimary,
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
    if (isAdmin) return 'Admin';
    final role = user?.role;
    if (role == 'service_provider') return 'Producer';
    if (role == 'dj') return 'DJ';
    if (role == 'musician') return 'Musician';
    if (isArtist || role == 'artist') return 'Artist';
    return 'Listener';
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
                            color: DimensionTokens.textSecondary,
                            fontSize: 13,
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
            borderRadius: BorderRadius.circular(8),
            onTap: onSignOut,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(
                children: [
                  Icon(
                    Icons.logout,
                    size: 22,
                    color: DimensionTokens.textSecondary,
                  ),
                  const SizedBox(width: 14),
                  Text(
                    'Sign out',
                    style: TextStyle(
                      fontSize: 15,
                      color: DimensionTokens.textPrimary,
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
