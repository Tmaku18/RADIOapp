import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/app_tutorial_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../invite/invite_friends_sheet.dart';

/// Help, support, and legal documents — surfaced from More, not Settings.
class HelpLegalScreen extends StatelessWidget {
  const HelpLegalScreen({super.key});

  Future<void> _openInApp(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.inAppWebView);
    }
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'Help & Legal',
      showNeonLine: true,
      body: ListView(
        children: [
          _section('Help', [
            _navTile(
              context,
              icon: Icons.person_add_alt_1_outlined,
              title: 'Invite friends',
              subtitle: 'Share the app by text, email, or anywhere else',
              onTap: () => InviteFriendsSheet.show(context),
            ),
            _navTile(
              context,
              icon: Icons.tour_outlined,
              title: 'App tour',
              subtitle:
                  'Walk through Radio, Pro-Radio, Discover, Nearby, and more',
              onTap: () async {
                Navigator.of(context).popUntil((route) => route.isFirst);
                await AppTutorialService.instance.reset();
                AppTutorialService.instance.requestReplay();
              },
            ),
            _navTile(
              context,
              icon: Icons.help_outline,
              title: 'Help & FAQ',
              subtitle: 'Answers and support',
              onTap: () => _openExternal('https://pro-networx.com/faq'),
            ),
            _navTile(
              context,
              icon: Icons.discord,
              title: 'Discord Support',
              subtitle: 'Chat with support and community',
              onTap: () => _openExternal('https://discord.gg/networx'),
            ),
            _navTile(
              context,
              icon: Icons.mail_outline,
              title: 'Contact Us',
              subtitle: 'Get in touch',
              onTap: () => _openExternal('https://pro-networx.com/contact'),
            ),
          ]),
          _section('Legal', [
            _navTile(
              context,
              icon: Icons.privacy_tip_outlined,
              title: 'Privacy Policy',
              subtitle: 'How we handle your data',
              onTap: () => _openInApp('https://pro-networx.com/privacy'),
            ),
            _navTile(
              context,
              icon: Icons.description_outlined,
              title: 'Terms of Service',
              subtitle: 'Rules and agreements',
              onTap: () => _openInApp('https://pro-networx.com/terms'),
            ),
            _navTile(
              context,
              icon: Icons.receipt_long_outlined,
              title: 'Refund Policy',
              subtitle: 'Returns and refunds',
              onTap: () => _openInApp('https://pro-networx.com/refunds'),
            ),
            _navTile(
              context,
              icon: Icons.shield_outlined,
              title: 'DMCA Policy',
              subtitle: 'Copyright takedown process',
              onTap: () => _openInApp('https://pro-networx.com/dmca'),
            ),
            _navTile(
              context,
              icon: Icons.groups_outlined,
              title: 'Community Guidelines',
              subtitle: 'Standards for the community',
              onTap: () =>
                  _openInApp('https://pro-networx.com/community-guidelines'),
            ),
            _navTile(
              context,
              icon: Icons.copyright_outlined,
              title: 'Copyright Policy',
              subtitle: 'Intellectual property rules',
              onTap: () =>
                  _openInApp('https://pro-networx.com/copyright-policy'),
            ),
            _navTile(
              context,
              icon: Icons.info_outline,
              title: 'About Networx',
              subtitle: 'Our mission and story',
              onTap: () => Navigator.pushNamed(context, AppRoutes.about),
            ),
            _navTile(
              context,
              icon: Icons.attach_money,
              title: 'Pricing',
              subtitle: 'Plans and pricing',
              onTap: () => _openExternal('https://pro-networx.com/pricing'),
            ),
          ]),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> tiles) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        DimensionSectionHeader(
          title: title,
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
        ),
        ...tiles,
      ],
    );
  }

  Widget _navTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    final scheme = Theme.of(context).colorScheme;
    return ListTile(
      leading: Icon(icon, size: 24),
      title: Text(title),
      subtitle: Text(
        subtitle,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
