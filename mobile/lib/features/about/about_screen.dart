import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/networx_extensions.dart';

/// About Networx — mission, story, values, and brand voice.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final surfaces = context.networxSurfaces;

    return Scaffold(
      appBar: AppBar(
        title: const Text('About Networx'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Where the People have the Voice, and the Artist has the Power.',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 24),
          _Section(
            title: 'Our Mission',
            body:
                'To maximize the frequency of "Butterfly Effects" by democratizing discovery. '
                'We exist to ensure that no "hidden gem" goes undiscovered and that talent is never '
                'sacrificed at the altar of lack of opportunity.',
            surfaces: surfaces,
          ),
          _Section(
            title: 'Our Story: The 4 AM Catalyst',
            body:
                'Most tech companies start in a Silicon Valley garage. Networx started at a gas station at 4 AM.\n\n'
                'That was where Tanaka and Merquise first crossed paths. It was a random connection—a "butterfly effect" '
                'in its purest form. We were two people who, on paper, were struggling financially, but in reality, '
                'were rich in skills and belief. As our friendship grew, we saw each other\'s strengths: Tanaka, the architect '
                'with the technical vision to build the impossible; Merquise, the strategist with the heart to find the talent others overlooked.\n\n'
                'We realized that our meeting shouldn\'t have been a fluke. We pushed each other to succeed when the world wasn\'t looking. '
                'We realized that society is full of "bright lights" that are allowed to die out simply because they didn\'t have a bridge '
                'to the right room. We decided that allowing talent to go to waste is more than a shame—it is a crime. '
                'We built Networx to make those 4 AM moments happen for everyone.',
            surfaces: surfaces,
          ),
          _Section(
            title: 'The Bridge from Invisible to Inevitable',
            body:
                'Networx is a "By Artists, For Artists" ecosystem. We are the first platform to combine high-fidelity democratic radio '
                'with a professional "Pro-Networx" hub.\n\n'
                'We don\'t believe in the "mysterious artist" enigma. We believe in the Human Artist. Our platform is built on real-time '
                'engagement through our Live Sync Chat, allowing creators to stand shoulder-to-shoulder with their listeners.\n\n'
                'More importantly, we are a bridge. We connect the inexperienced "hidden gem" with the seasoned veteran. Through our '
                'LinkedIn-style portal, we facilitate mentorships where Catalysts (service providers)—photographers, promoters, and producers—guide '
                'the next generation on their journey to fame. We aren\'t just playing music; we are architecting careers.',
            surfaces: surfaces,
          ),
          _Section(
            title: 'The Networx Values (The Code)',
            body: null,
            surfaces: surfaces,
            bullets: const [
              'Potential in Everyone: We believe talent is universal, but opportunity is not. We are here to fix the distribution.',
              'The "Trial by Fire" Democracy: Our charts aren\'t bought; they are earned. Votes reflect the true opinion of the people.',
              'Pure Listening, No Noise: Music should be free to hear without intrusive ads. We keep the frequency clean.',
              'Human Connectivity: We reject the "enigma" model. If your song is playing, you should be in the room with your fans.',
              'Mentorship over Monopoly: The experienced have a duty to guide the inexperienced. We foster guidance, not gatekeeping.',
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'Legal',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 8),
          _LinkTile(
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            url: 'https://pro-networx.com/privacy',
            inApp: true,
          ),
          _LinkTile(
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            url: 'https://pro-networx.com/terms',
            inApp: true,
          ),
          _LinkTile(
            icon: Icons.receipt_long_outlined,
            title: 'Refund Policy',
            url: 'https://pro-networx.com/refunds',
            inApp: true,
          ),
          _LinkTile(
            icon: Icons.shield_outlined,
            title: 'DMCA Policy',
            url: 'https://pro-networx.com/dmca',
            inApp: true,
          ),
          _LinkTile(
            icon: Icons.groups_outlined,
            title: 'Community Guidelines',
            url: 'https://pro-networx.com/community-guidelines',
            inApp: true,
          ),
          _LinkTile(
            icon: Icons.copyright_outlined,
            title: 'Copyright Policy',
            url: 'https://pro-networx.com/copyright-policy',
            inApp: true,
          ),
          const SizedBox(height: 16),
          Text(
            'Resources',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 8),
          _LinkTile(
            icon: Icons.help_outline,
            title: 'FAQ',
            url: 'https://pro-networx.com/faq',
            inApp: false,
          ),
          _LinkTile(
            icon: Icons.mail_outline,
            title: 'Contact Us',
            url: 'https://pro-networx.com/contact',
            inApp: false,
          ),
          _LinkTile(
            icon: Icons.attach_money,
            title: 'Pricing',
            url: 'https://pro-networx.com/pricing',
            inApp: false,
          ),
          _LinkTile(
            icon: Icons.public,
            title: 'Pro-Directory',
            url: 'https://pro-networx.com/pro-directory',
            inApp: false,
          ),
          const SizedBox(height: 24),
          Card(
            color: scheme.primary.withValues(alpha: 0.08),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Join the movement',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontFamily: 'Lora',
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Networx isn\'t just about code—it\'s about a real friendship and a shared struggle. '
                    'Be part of something built for artists, by artists.',
                    style: TextStyle(color: surfaces.textSecondary, fontSize: 14),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.title,
    required this.url,
    required this.inApp,
  });

  final IconData icon;
  final String title;
  final String url;
  final bool inApp;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 20),
      title: Text(title),
      trailing: Icon(
        inApp ? Icons.open_in_browser : Icons.launch,
        size: 16,
        color: Theme.of(context).colorScheme.outline,
      ),
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(
            uri,
            mode: inApp
                ? LaunchMode.inAppWebView
                : LaunchMode.externalApplication,
          );
        }
      },
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.surfaces,
    this.body,
    this.bullets,
  });

  final String title;
  final NetworxSurfaces surfaces;
  final String? body;
  final List<String>? bullets;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 10),
          if (body != null)
            Text(
              body!,
              style: TextStyle(color: surfaces.textSecondary, height: 1.5),
            ),
          if (bullets != null) ...[
            const SizedBox(height: 8),
            ...bullets!.map(
              (b) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '• ',
                      style: TextStyle(
                        color: surfaces.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        b,
                        style: TextStyle(
                          color: surfaces.textSecondary,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
