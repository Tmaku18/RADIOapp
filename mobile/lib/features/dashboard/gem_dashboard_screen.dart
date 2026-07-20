import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/auth/role_helpers.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Gem / Catalyst / Admin home hub — web `/dashboard` artist actions parity.
/// Primary entry for Upload when the user isn't on the Radio tab.
class GemDashboardScreen extends StatelessWidget {
  const GemDashboardScreen({super.key, this.onOpenNavDrawer});

  final VoidCallback? onOpenNavDrawer;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context, listen: false);

    return FutureBuilder(
      future: auth.getUserProfile(),
      builder: (context, snapshot) {
        final role = snapshot.data?.role;
        final title = role == 'admin'
            ? 'Admin Home'
            : role == 'service_provider'
                ? 'Catalyst Home'
                : 'Gem Home';
        final subtitle = role == 'admin'
            ? 'Upload music, manage the platform, and grow the network.'
            : role == 'service_provider'
                ? 'Upload music, offer services, and grow with gems.'
                : 'Upload music and grow your discoveries.';

        return Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: Colors.transparent,
            leading: onOpenNavDrawer != null
                ? IconButton(
                    icon: const Icon(Icons.menu),
                    tooltip: 'Menu',
                    onPressed: onOpenNavDrawer,
                  )
                : null,
            title: Text(title),
            actions: [
              if (hasArtistCapability(role))
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilledButton.icon(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.upload),
                    icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                    label: const Text('Upload'),
                    style: FilledButton.styleFrom(
                      backgroundColor: DimensionTokens.neonCyan,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                  ),
                ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: [
              Text(
                subtitle,
                style: GoogleFonts.outfit(
                  color: DimensionTokens.textSecondary,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              GlassCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Upload Music',
                      style: GoogleFonts.outfit(
                        color: DimensionTokens.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Submit tracks for radio rotation — same fields as the website.',
                      style: GoogleFonts.outfit(
                        color: DimensionTokens.textMuted,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 14),
                    FilledButton.icon(
                      onPressed: () =>
                          Navigator.pushNamed(context, AppRoutes.upload),
                      icon: const Icon(Icons.cloud_upload_outlined),
                      label: const Text('Upload a song'),
                      style: FilledButton.styleFrom(
                        backgroundColor: DimensionTokens.neonCyan,
                        foregroundColor: Colors.black,
                        minimumSize: const Size.fromHeight(48),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'QUICK ACTIONS',
                style: GoogleFonts.jetBrainsMono(
                  color: DimensionTokens.pink400,
                  fontSize: 10,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 10),
              _DashTile(
                icon: Icons.library_music_outlined,
                title: 'My Songs',
                desc: 'Manage uploads, samples, and Discover clips.',
                onTap: () => Navigator.pushNamed(context, AppRoutes.studio),
              ),
              _DashTile(
                icon: Icons.show_chart,
                title: 'Analytics',
                desc: 'Track listens, engagement, and growth.',
                onTap: () => Navigator.pushNamed(context, AppRoutes.analytics),
              ),
              _DashTile(
                icon: Icons.event_available_outlined,
                title: 'Live Services',
                desc: 'Schedule and manage live events.',
                onTap: () =>
                    Navigator.pushNamed(context, AppRoutes.liveServices),
              ),
              _DashTile(
                icon: Icons.payments_outlined,
                title: 'Credits',
                desc: 'Buy plays and manage credits.',
                onTap: () => Navigator.pushNamed(context, AppRoutes.credits),
              ),
              _DashTile(
                icon: Icons.science_outlined,
                title: 'The Refinery',
                desc: 'Get an in-depth review of your song.',
                onTap: () => Navigator.pushNamed(context, AppRoutes.refinery),
              ),
              _DashTile(
                icon: Icons.work_outline,
                title: 'Pro-Networx',
                desc: 'Find and offer creative services.',
                onTap: () =>
                    Navigator.pushNamed(context, AppRoutes.proNetworxShell),
              ),
              if (role == 'admin')
                _DashTile(
                  icon: Icons.shield_outlined,
                  title: 'Admin Dashboard',
                  desc: 'Songs, queue, users, and platform tools.',
                  onTap: () =>
                      Navigator.pushNamed(context, AppRoutes.adminDashboard),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _DashTile extends StatelessWidget {
  const _DashTile({
    required this.icon,
    required this.title,
    required this.desc,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String desc;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          onTap: onTap,
          leading: Icon(icon, color: DimensionTokens.neonCyan),
          title: Text(
            title,
            style: GoogleFonts.outfit(
              fontWeight: FontWeight.w700,
              color: DimensionTokens.textPrimary,
            ),
          ),
          subtitle: Text(
            desc,
            style: GoogleFonts.outfit(
              fontSize: 12,
              color: DimensionTokens.textMuted,
            ),
          ),
          trailing: const Icon(Icons.chevron_right, size: 20),
        ),
      ),
    );
  }
}
