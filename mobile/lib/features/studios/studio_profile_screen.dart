import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/studio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/studio_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../pro_networx/widgets/pro_network_paywall_sheet.dart';

class StudioProfileScreen extends StatefulWidget {
  const StudioProfileScreen({super.key, required this.studioId});

  final String studioId;

  @override
  State<StudioProfileScreen> createState() => _StudioProfileScreenState();
}

class _StudioProfileScreenState extends State<StudioProfileScreen> {
  final StudioService _service = StudioService();
  Studio? _studio;
  String? _error;
  bool _loading = true;

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
      final studio = await _service.getOne(widget.studioId);
      if (!mounted) return;
      setState(() => _studio = studio);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<bool> _requireSubscription() async {
    if (_studio?.contactLocked != true) return true;
    final ok = await ProNetworkPaywallSheet.show(
      context,
      title: 'Contact this studio',
      description:
          'A Pro-Networx subscription is required to message or contact studios.',
    );
    if (ok == true && mounted) {
      await _load();
      return _studio?.contactLocked != true;
    }
    return false;
  }

  Future<void> _messageOwner() async {
    final studio = _studio;
    if (studio == null || studio.ownerUserId.isEmpty) return;
    if (!await _requireSubscription()) return;
    if (!mounted) return;
    Navigator.pushNamed(
      context,
      AppRoutes.thread,
      arguments: {
        'myUserId': '',
        'otherUserId': studio.ownerUserId,
        'otherDisplayName': studio.ownerDisplayName ?? studio.name,
      },
    );
  }

  Future<void> _contactMember(StudioMember member) async {
    if (member.userId.isEmpty) return;
    if (!await _requireSubscription()) return;
    if (!mounted) return;
    Navigator.pushNamed(
      context,
      AppRoutes.thread,
      arguments: {
        'myUserId': '',
        'otherUserId': member.userId,
        'otherDisplayName': member.displayName ?? member.title ?? 'Producer',
      },
    );
  }

  Future<void> _launchContact() async {
    if (!await _requireSubscription()) return;
    final studio = _studio;
    if (studio == null) return;
    final email = studio.contactEmail?.trim() ?? '';
    final phone = studio.contactPhone?.trim() ?? '';
    final link = studio.bookingLink?.trim() ?? '';
    final uri = email.isNotEmpty
        ? Uri(scheme: 'mailto', path: email)
        : phone.isNotEmpty
            ? Uri(scheme: 'tel', path: phone)
            : Uri.tryParse(link);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final studio = _studio;
    return DimensionScreenShell(
      title: studio?.name ?? 'Studio',
      showNeonLine: true,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!),
              ),
            )
          : studio == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              children: [
                if ((studio.heroImageUrl ?? '').isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AspectRatio(
                      aspectRatio: 16 / 9,
                      child: Image.network(
                        studio.heroImageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => _heroFallback(),
                      ),
                    ),
                  )
                else
                  _heroFallback(),
                const SizedBox(height: 16),
                if ((studio.tagline ?? '').isNotEmpty)
                  Text(
                    studio.tagline!,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                if (studio.startingAtLabel != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    studio.startingAtLabel!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: NetworxTokens.electricCyan,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if ((studio.hoursSummary ?? '').isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    studio.hoursSummary!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                if (studio.locationLine.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    studio.isExact
                        ? studio.locationLine
                        : '${studio.city ?? ''}'
                              '${(studio.zipCode ?? '').isNotEmpty ? ' · ${studio.zipCode}' : ''}'
                              ' (approximate area)',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                if (studio.photos.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 120,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: studio.photos.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          studio.photos[i],
                          width: 160,
                          height: 120,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            width: 160,
                            color: Colors.black26,
                            child: const Icon(Icons.image_not_supported),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: studio.ownerUserId.isEmpty ? null : _launchContact,
                  icon: const Icon(Icons.call_outlined),
                  label: Text(
                    studio.contactLocked
                        ? 'Contact us (Pro-Networx)'
                        : 'Contact us',
                  ),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed:
                      studio.ownerUserId.isEmpty ? null : _messageOwner,
                  icon: const Icon(Icons.mail_outline),
                  label: const Text('Message studio'),
                ),
                if ((studio.about ?? '').isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'About us',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(studio.about!),
                ],
                if (studio.hours.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'Hours',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...studio.hours.map(
                    (h) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          SizedBox(width: 44, child: Text(h.day)),
                          Text(
                            h.closed || h.open == null
                                ? 'Closed'
                                : '${h.open}–${h.close}',
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (studio.members.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'Book a producer or artist',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...studio.members.map(
                    (m) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundImage: (m.avatarUrl ?? '').isNotEmpty
                            ? NetworkImage(m.avatarUrl!)
                            : null,
                        child: (m.avatarUrl ?? '').isEmpty
                            ? const Icon(Icons.person_outline)
                            : null,
                      ),
                      title: Text(m.displayName ?? 'Creator'),
                      subtitle: Text(
                        [
                          if ((m.title ?? '').isNotEmpty) m.title,
                          if ((m.headline ?? '').isNotEmpty) m.headline,
                        ].join(' · '),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => _contactMember(m),
                    ),
                  ),
                ],
                if (studio.amenities.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'Amenities',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final a in studio.amenities) Chip(label: Text(a)),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  'Rates',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (studio.rates.isEmpty)
                  const Text('Contact the owner for pricing.')
                else
                  ...studio.rates.map(
                    (r) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(r.label),
                      subtitle: (r.notes ?? '').isNotEmpty ? Text(r.notes!) : null,
                      trailing: Text(
                        r.formattedPrice,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _heroFallback() {
    return Container(
      height: 160,
      decoration: BoxDecoration(
        color: NetworxTokens.warning.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: NetworxTokens.warning.withValues(alpha: 0.5),
        ),
      ),
      child: const Center(
        child: Icon(Icons.apartment, size: 48, color: NetworxTokens.warning),
      ),
    );
  }
}
