import 'package:flutter/material.dart';

import '../../core/constants/pro_networx_pricing.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Public marketing landing page for Pro Networks. Shown when not signed in
/// or for users that haven't yet entered the authenticated shell.
class ProNetworxLandingScreen extends StatelessWidget {
  const ProNetworxLandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'PRO-NETWORX',
      showNeonLine: true,
      actions: [
        const BackToNetworxRadioButton(compact: true),
        TextButton(
          onPressed: () => Navigator.of(context).pushNamed(AppRoutes.login),
          child: Text(
            'Sign in',
            style: DimensionTypography.monoCaps(
              color: DimensionTokens.cyan300,
              fontSize: 11,
            ),
          ),
        ),
      ],
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Networking, hiring, and showcasing for every kind of creative.',
                style: DimensionTypography.pageTitle(fontSize: 22),
              ),
              const SizedBox(height: 12),
              Text(
                'Graphic designers, photographers, videographers, illustrators, '
                'lyricists, beat makers, producers, and more — Pro-Networx is '
                'a LinkedIn-meets-Instagram space built for artists.',
                style: DimensionTypography.pageSubtitle(),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  const BackToNetworxRadioButton(),
                  DimensionCtaButton(
                    label: 'Join free',
                    onPressed: () =>
                        Navigator.of(context).pushNamed(AppRoutes.login),
                  ),
                  DimensionCtaButton(
                    label: 'Continue as guest',
                    variant: DimensionCtaVariant.secondary,
                    onPressed: () => Navigator.of(context)
                        .pushReplacementNamed(AppRoutes.proNetworxShell),
                  ),
                ],
              ),
              const SizedBox(height: 36),
              _SectionHeader("What's inside"),
              const SizedBox(height: 12),
              const _FeatureTile(
                icon: Icons.work_outline,
                title: 'LinkedIn-style profile',
                description:
                    'Banner, headline, about, skills, experience, education, '
                    'social links, and a downloadable resume PDF.',
              ),
              const _FeatureTile(
                icon: Icons.grid_on,
                title: 'Instagram-style portfolio',
                description:
                    'Post your work to your grid. Followers see it on Home; '
                    'everyone discovers it on Search.',
              ),
              const _FeatureTile(
                icon: Icons.storefront_outlined,
                title: 'Services marketplace',
                description:
                    'List services with prices. Contact info is hidden from '
                    'non-subscribers and revealed once they subscribe.',
              ),
              const _FeatureTile(
                icon: Icons.chat_bubble_outline,
                title: 'Direct messaging',
                description:
                    'Subscribe once and message any creator on Pro-Networx.',
              ),
              const _FeatureTile(
                icon: Icons.radio,
                title: 'Networks Radio in the background',
                description:
                    'Keep underground music playing while you browse, post, '
                    'and message.',
              ),
              const _FeatureTile(
                icon: Icons.account_circle_outlined,
                title: 'Unified account',
                description:
                    'One login for Pro-Networx and Networks Radio. Sign up on '
                    'either side and your profile is created on the other.',
              ),
              const SizedBox(height: 28),
              _PricingCard(),
              const SizedBox(height: 24),
              Text(
                'LinkedIn is a trademark of LinkedIn Corporation. Pro-Networx is not '
                'affiliated with, sponsored by, or endorsed by LinkedIn.',
                style: DimensionTypography.bodyMuted(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;
  @override
  Widget build(BuildContext context) {
    return Text(text, style: DimensionTypography.cardTitle(fontSize: 20));
  }
}

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.icon,
    required this.title,
    required this.description,
  });
  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: GlassCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: DimensionTokens.cyan300.withValues(alpha: 0.12),
              child: Icon(icon, color: DimensionTokens.cyan300, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: DimensionTypography.cardTitle(fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(description, style: DimensionTypography.body()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PricingCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return GlassCard(
      strong: true,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pro-Networx subscription',
            style: DimensionTypography.cardTitle(fontSize: 20),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$proNetworxRegularDisplay/mo',
                style: DimensionTypography.bodyMuted().copyWith(
                  decoration: TextDecoration.lineThrough,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                proNetworxIntroDisplay,
                style: DimensionTypography.accentCyan(fontSize: 22),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'first month',
                  style: DimensionTypography.bodyMuted(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Then $proNetworxRegularDisplay/mo. Cancel anytime.',
            style: DimensionTypography.bodyMuted(),
          ),
          const SizedBox(height: 14),
          DimensionCtaButton(
            label: 'Sign up to subscribe',
            onPressed: () => Navigator.of(context).pushNamed(AppRoutes.login),
          ),
        ],
      ),
    );
  }
}
