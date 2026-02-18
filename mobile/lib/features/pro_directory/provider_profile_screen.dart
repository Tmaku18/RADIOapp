import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/service_provider_profile.dart';
import '../../core/services/service_providers_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../messages/messages_screen.dart';

class ProviderProfileScreen extends StatefulWidget {
  final String userId;
  const ProviderProfileScreen({super.key, required this.userId});

  @override
  State<ProviderProfileScreen> createState() => _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends State<ProviderProfileScreen> {
  final ServiceProvidersService _service = ServiceProvidersService();
  bool _loading = true;
  ServiceProviderProfile? _profile;
  String? _error;
  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final me = await auth.getUserProfile();
      final profile = await _service.getByUserId(widget.userId);
      if (!mounted) return;
      setState(() {
        _myUserId = me?.id;
        _profile = profile;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openUrl(String? url) async {
    if (url == null || url.trim().isEmpty) return;
    final uri = Uri.tryParse(url.trim());
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null || _profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Catalyst')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              _error ?? 'Failed to load profile',
              style: TextStyle(color: surfaces.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final p = _profile!;
    final hero = (p.heroImageUrl?.isNotEmpty == true)
        ? p.heroImageUrl!
        : (p.portfolio.isNotEmpty ? p.portfolio.first.fileUrl : null);

    return Scaffold(
      appBar: AppBar(title: Text(p.displayName ?? 'Industry Catalyst')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Hero
          Card(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: hero != null
                    ? CachedNetworkImage(
                        imageUrl: hero,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => Container(
                          color: surfaces.elevated,
                          alignment: Alignment.center,
                          child: const Icon(Icons.image_outlined, size: 48),
                        ),
                      )
                    : Container(
                        color: surfaces.elevated,
                        alignment: Alignment.center,
                        child: const Icon(Icons.image_outlined, size: 48),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.displayName ?? 'Industry Catalyst',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontFamily: 'Lora'),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p.locationRegion ?? '',
                      style: TextStyle(color: surfaces.textMuted),
                    ),
                  ],
                ),
              ),
              if (p.mentorOptIn)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: scheme.primary.withValues(alpha: 0.22)),
                  ),
                  child: Text(
                    'Mentor',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                        ),
                  ),
                ),
            ],
          ),

          if ((p.bio ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(p.bio!.trim(), style: TextStyle(color: surfaces.textSecondary)),
          ],

          const SizedBox(height: 14),

          // Primary CTA: DM
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _myUserId == null
                  ? null
                  : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ThreadScreen(
                            myUserId: _myUserId!,
                            otherUserId: p.userId,
                            otherDisplayName: p.displayName,
                          ),
                        ),
                      );
                    },
              icon: const Icon(Icons.mail_outline),
              label: const Text('Direct Message'),
            ),
          ),

          const SizedBox(height: 10),

          // Social bridge
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              if ((p.instagramUrl ?? '').isNotEmpty)
                OutlinedButton(
                  onPressed: () => _openUrl(p.instagramUrl),
                  child: const Text('Instagram'),
                ),
              if ((p.linkedinUrl ?? '').isNotEmpty)
                OutlinedButton(
                  onPressed: () => _openUrl(p.linkedinUrl),
                  child: const Text('LinkedIn'),
                ),
              if ((p.portfolioUrl ?? '').isNotEmpty)
                OutlinedButton(
                  onPressed: () => _openUrl(p.portfolioUrl),
                  child: const Text('Portfolio'),
                ),
            ],
          ),

          const SizedBox(height: 18),

          // Service Menu (table-ish)
          Text('Service menu', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (p.listings.isEmpty)
            Text('No services listed yet.', style: TextStyle(color: surfaces.textSecondary))
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: p.listings.map((l) {
                    final price = l.rateCents == null ? '—' : '\$${(l.rateCents! / 100).toStringAsFixed(2)}';
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(l.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                const SizedBox(height: 4),
                                if ((l.description ?? '').trim().isNotEmpty)
                                  Text(l.description!.trim(), style: TextStyle(color: surfaces.textSecondary)),
                                const SizedBox(height: 4),
                                Text(l.serviceType, style: TextStyle(color: surfaces.textMuted, fontSize: 12)),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            price,
                            style: TextStyle(
                              color: scheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

          const SizedBox(height: 18),

          // Portfolio
          Text('Portfolio', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (p.portfolio.isEmpty)
            Text('No portfolio items yet.', style: TextStyle(color: surfaces.textSecondary))
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1,
              ),
              itemCount: p.portfolio.length,
              itemBuilder: (context, i) {
                final item = p.portfolio[i];
                return Card(
                  child: InkWell(
                    onTap: () => _openUrl(item.fileUrl),
                    borderRadius: BorderRadius.circular(16),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (item.type == 'image')
                            CachedNetworkImage(
                              imageUrl: item.fileUrl,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) => Container(
                                color: surfaces.elevated,
                                alignment: Alignment.center,
                                child: const Icon(Icons.image_outlined),
                              ),
                            )
                          else
                            Container(
                              color: surfaces.elevated,
                              alignment: Alignment.center,
                              child: Icon(
                                item.type == 'audio'
                                    ? Icons.audiotrack
                                    : Icons.play_circle_outline,
                                size: 44,
                                color: scheme.primary,
                              ),
                            ),
                          Positioned(
                            left: 10,
                            bottom: 10,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.55),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                              ),
                              child: Text(
                                item.type.toUpperCase(),
                                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

