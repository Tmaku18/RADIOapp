import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/services/analytics_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../core/theme/networx_tokens.dart';

/// About Networx — mission, story, values, and brand voice.
class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  final AnalyticsService _analytics = AnalyticsService();
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final stats = await _analytics.getPlatformStats();
      if (mounted) setState(() => _stats = stats);
    } catch (_) {
      // Non-fatal: the stats strip simply stays hidden if this fails.
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final surfaces = context.networxSurfaces;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final wordmarkStops = isDark
        ? const [
            Color(0xFFEAFEFF),
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
          ]
        : const [
            NetworxTokens.electricCyan,
            NetworxTokens.electricCyanHover,
            NetworxTokens.deepCobalt,
          ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('About Networx'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ShaderMask(
            shaderCallback: (bounds) => LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: wordmarkStops,
            ).createShader(bounds),
            child: Text(
              'NETWORX',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 4,
                  ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Where the People have the Voice, and the Artist has the Power.',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 20),
          if (_stats != null) ...[
            _StatsStrip(stats: _stats!, surfaces: surfaces),
            const SizedBox(height: 24),
          ],
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
              'Always Free to Listen: Listening is free, and it always will be. Light, non-intrusive ads plus artist and marketplace revenue keep it that way\u2014so discovery never sits behind a paywall.',
              'Human Connectivity: We reject the "enigma" model. If your song is playing, you should be in the room with your fans.',
              'Mentorship over Monopoly: The experienced have a duty to guide the inexperienced. We foster guidance, not gatekeeping.',
            ],
          ),
          Text(
            'The Language of Networx',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 6),
          Text(
            'Our world runs on three ideas: the Butterfly Effect, the artist\'s Metamorphosis, and the Mining of hidden talent.',
            style: TextStyle(color: surfaces.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 16),
          ..._glossary.map(
            (group) => _GlossaryGroup(group: group, surfaces: surfaces),
          ),
          const SizedBox(height: 8),
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

/// Platform-wide totals shown at the top of the About screen.
class _StatsStrip extends StatelessWidget {
  const _StatsStrip({required this.stats, required this.surfaces});

  final Map<String, dynamic> stats;
  final NetworxSurfaces surfaces;

  int _val(String key) {
    final v = stats[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    return 0;
  }

  String _fmt(int n) {
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M+';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K+';
    return n.toString();
  }

  @override
  Widget build(BuildContext context) {
    final items = <List<String>>[
      [_fmt(_val('totalUsers')), 'Members'],
      [_fmt(_val('totalSongs')), 'Songs'],
      [_fmt(_val('earsReached')), 'Ears Reached'],
      [_fmt(_val('totalLikes')), 'Ripples'],
    ];
    final scheme = Theme.of(context).colorScheme;
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.6,
      children: items
          .map(
            (it) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    it[0],
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  Text(
                    it[1],
                    style: TextStyle(
                      color: surfaces.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

/// A metaphor family (e.g. The Butterfly Effect) and its defined terms.
class _GlossaryItem {
  const _GlossaryItem(this.term, this.definition);
  final String term;
  final String definition;
}

class _GlossaryGroupData {
  const _GlossaryGroupData(this.system, this.tagline, this.terms);
  final String system;
  final String tagline;
  final List<_GlossaryItem> terms;
}

const List<_GlossaryGroupData> _glossary = [
  _GlossaryGroupData(
    'The Butterfly Effect',
    'One small ripple can become a storm.',
    [
      _GlossaryItem('The Butterfly Effect',
          'A single vote or discovery can set off the chain reaction that launches an artist\'s career.'),
      _GlossaryItem('Ripples',
          'The audience\'s votes and likes. Every ripple carries an artist\'s sound a little further.'),
      _GlossaryItem('The Wake',
          'An artist\'s analytics report — the path left behind by a thousand Ripples.'),
    ],
  ),
  _GlossaryGroupData(
    'Metamorphosis',
    'The journey from unseen talent to recognized artist.',
    [
      _GlossaryItem('Metamorphosis',
          'The transformation every artist undergoes — from an unknown upload to a name the people know.'),
      _GlossaryItem('Gem',
          'An artist. A hidden gem, ready to be heard and refined by the community.'),
      _GlossaryItem('Diamond',
          'A Gem refined under pressure — a standout artist the community has voted into the spotlight.'),
      _GlossaryItem('Catalyst',
          'A creative service provider (producer, photographer, mentor) who speeds up the metamorphosis through Pro-Networx.'),
    ],
  ),
  _GlossaryGroupData(
    'Mining',
    'Surfacing value from the live frequency.',
    [
      _GlossaryItem('Mining the Frequency',
          'How value is surfaced from the always-on stream — the people dig through the radio to find what shines.'),
      _GlossaryItem('Prospectors',
          'The listeners. They tune in, send Ripples, and refine raw songs into signal the market can trust.'),
      _GlossaryItem('The Refinery',
          'The portal where Prospectors rank, survey, and comment to refine songs before they break out.'),
      _GlossaryItem('The Yield',
          'A Prospector\'s rewards — steady earnings from verified engagement like refinement, surveys, and feedback.'),
    ],
  ),
];

class _GlossaryGroup extends StatelessWidget {
  const _GlossaryGroup({required this.group, required this.surfaces});

  final _GlossaryGroupData group;
  final NetworxSurfaces surfaces;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            group.system,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'Lora',
                ),
          ),
          const SizedBox(height: 2),
          Text(
            group.tagline,
            style: TextStyle(
              color: surfaces.textSecondary,
              fontStyle: FontStyle.italic,
            ),
          ),
          const SizedBox(height: 10),
          ...group.terms.map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: RichText(
                text: TextSpan(
                  style: TextStyle(color: surfaces.textSecondary, height: 1.5),
                  children: [
                    TextSpan(
                      text: '${t.term}: ',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(text: t.definition),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
