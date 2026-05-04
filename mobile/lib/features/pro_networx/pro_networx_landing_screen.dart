import 'package:flutter/material.dart';

import '../../core/constants/pro_networx_pricing.dart';
import '../../core/navigation/app_routes.dart';

/// Public marketing landing page for Pro Networks. Shown when not signed in
/// or for users that haven't yet entered the authenticated shell.
class ProNetworxLandingScreen extends StatelessWidget {
  const ProNetworxLandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('PRO-NETWORX'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pushNamed(AppRoutes.login),
            child: const Text('Sign in'),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Networking, hiring, and showcasing for every kind of creative.',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Graphic designers, photographers, videographers, illustrators, '
                'lyricists, beat makers, producers, and more — Pro-Networx is '
                'a LinkedIn-meets-Instagram space built for artists.',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  FilledButton(
                    onPressed: () => Navigator.of(context).pushNamed(
                      AppRoutes.login,
                    ),
                    child: const Text('Join free'),
                  ),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pushReplacementNamed(
                      AppRoutes.proNetworxShell,
                    ),
                    child: const Text('Continue as guest'),
                  ),
                ],
              ),
              const SizedBox(height: 36),
              _SectionHeader("What's inside"),
              const SizedBox(height: 12),
              _FeatureTile(
                icon: Icons.work_outline,
                title: 'LinkedIn-style profile',
                description:
                    'Banner, headline, about, skills, experience, education, '
                    'social links, and a downloadable resume PDF.',
              ),
              _FeatureTile(
                icon: Icons.grid_on,
                title: 'Instagram-style portfolio',
                description:
                    'Post your work to your grid. Followers see it on Home; '
                    'everyone discovers it on Search.',
              ),
              _FeatureTile(
                icon: Icons.storefront_outlined,
                title: 'Services marketplace',
                description:
                    'List services with prices. Contact info is hidden from '
                    'non-subscribers and revealed once they subscribe.',
              ),
              _FeatureTile(
                icon: Icons.chat_bubble_outline,
                title: 'Direct messaging',
                description:
                    'Subscribe once and message any creator on Pro-Networx.',
              ),
              _FeatureTile(
                icon: Icons.radio,
                title: 'Networks Radio in the background',
                description:
                    'Keep underground music playing while you browse, post, '
                    'and message.',
              ),
              _FeatureTile(
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
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: cs.onSurfaceVariant),
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
    return Text(
      text,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
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
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: cs.primary.withValues(alpha: 0.12),
            child: Icon(icon, color: cs.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    )),
                const SizedBox(height: 2),
                Text(description,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                    )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PricingCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: cs.primary.withValues(alpha: 0.06),
        border: Border.all(color: cs.primary.withValues(alpha: 0.2)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Pro-Networx subscription',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              )),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$proNetworxRegularDisplay/mo',
                style: theme.textTheme.titleMedium?.copyWith(
                  decoration: TextDecoration.lineThrough,
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                proNetworxIntroDisplay,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 6),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  'first month',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: cs.onSurfaceVariant),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Then $proNetworxRegularDisplay/mo. Cancel anytime.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: () => Navigator.of(context).pushNamed(AppRoutes.login),
            child: const Text('Sign up to subscribe'),
          ),
        ],
      ),
    );
  }
}

