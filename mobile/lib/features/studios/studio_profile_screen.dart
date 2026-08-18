import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/studio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/studio_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

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

  void _messageOwner() {
    final studio = _studio;
    if (studio == null || studio.ownerUserId.isEmpty) return;
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

  Future<void> _book() async {
    final link = _studio?.bookingLink?.trim() ?? '';
    if (link.isEmpty) return;
    final uri = Uri.tryParse(link);
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
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: studio.ownerUserId.isEmpty
                            ? null
                            : _messageOwner,
                        icon: const Icon(Icons.mail_outline),
                        label: const Text('Message'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: (studio.bookingLink ?? '').isEmpty
                            ? null
                            : _book,
                        icon: const Icon(Icons.event_available_outlined),
                        label: const Text('Book'),
                      ),
                    ),
                  ],
                ),
                if ((studio.about ?? '').isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Text(
                    'About',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(studio.about!),
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
