import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/pro_networx_service.dart';
import 'widgets/pro_network_paywall_sheet.dart';

class ProServiceDetailScreen extends StatefulWidget {
  const ProServiceDetailScreen({super.key, required this.serviceId});
  final String serviceId;

  @override
  State<ProServiceDetailScreen> createState() => _ProServiceDetailScreenState();
}

class _ProServiceDetailScreenState extends State<ProServiceDetailScreen> {
  final ProNetworxService _service = ProNetworxService();
  ProServiceListing? _listing;
  bool _loading = true;
  String? _error;

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
      final listing = await _service.getService(widget.serviceId);
      if (!mounted) return;
      setState(() => _listing = listing);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Failed to load service.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openSubscribe() async {
    final ok = await ProNetworkPaywallSheet.show(
      context,
      title: 'Subscribe to view contact info',
      description:
          "Subscribe to view this creator's email, phone, and direct booking links.",
    );
    if (ok == true) {
      _load();
    }
  }

  String _formatPrice() {
    final cents = _listing?.priceCents;
    if (cents == null || cents <= 0) return 'Contact for pricing';
    final dollars = (cents / 100).toStringAsFixed(2);
    final cur = (_listing?.currency ?? 'USD').toUpperCase();
    final symbol = cur == 'USD' ? '\$' : '$cur ';
    return '$symbol$dollars${_listing?.rateType == 'hourly' ? '/hr' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _listing == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_error ?? 'Service not found.')),
      );
    }
    final listing = _listing!;
    final hasContact = listing.contact != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Service')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          InkWell(
            onTap: () => Navigator.of(context).pushNamed(
              AppRoutes.proProfile,
              arguments: listing.ownerUserId,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundImage: listing.ownerAvatarUrl != null &&
                          listing.ownerAvatarUrl!.isNotEmpty
                      ? CachedNetworkImageProvider(listing.ownerAvatarUrl!)
                      : null,
                  backgroundColor: cs.surfaceContainerHighest,
                  child: (listing.ownerAvatarUrl == null ||
                          listing.ownerAvatarUrl!.isEmpty)
                      ? const Icon(Icons.brush)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        listing.ownerDisplayName ?? 'Creator',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if ((listing.ownerHeadline ?? '').isNotEmpty)
                        Text(
                          listing.ownerHeadline!,
                          style: theme.textTheme.bodySmall
                              ?.copyWith(color: cs.onSurfaceVariant),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            listing.serviceType.replaceAll('_', ' ').toUpperCase(),
            style: theme.textTheme.labelMedium?.copyWith(
              letterSpacing: 1.2,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            listing.title,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          if ((listing.description ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(listing.description!, style: theme.textTheme.bodyLarge),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: cs.outlineVariant),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Text(
                  _formatPrice(),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                if (hasContact)
                  TextButton.icon(
                    onPressed: () => Navigator.of(context).pushNamed(
                      AppRoutes.thread,
                      arguments: <String, dynamic>{
                        'myUserId': '',
                        'otherUserId': listing.ownerUserId,
                        'otherDisplayName': listing.ownerDisplayName,
                      },
                    ),
                    icon: const Icon(Icons.message_outlined),
                    label: const Text('Message'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (hasContact) ...[
            Text('Contact', style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            if ((listing.contact!.email ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.email_outlined),
                title: Text(listing.contact!.email!),
                onTap: () =>
                    launchUrl(Uri.parse('mailto:${listing.contact!.email!}')),
              ),
            if ((listing.contact!.phone ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.phone_outlined),
                title: Text(listing.contact!.phone!),
                onTap: () =>
                    launchUrl(Uri.parse('tel:${listing.contact!.phone!}')),
              ),
            if ((listing.contact!.link ?? '').isNotEmpty)
              ListTile(
                leading: const Icon(Icons.link),
                title: Text(listing.contact!.link!),
                onTap: () => launchUrl(
                  Uri.parse(listing.contact!.link!),
                  mode: LaunchMode.externalApplication,
                ),
              ),
            if ((listing.contact!.email ?? '').isEmpty &&
                (listing.contact!.phone ?? '').isEmpty &&
                (listing.contact!.link ?? '').isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'This creator has not added contact details. Send them a message instead.',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: cs.onSurfaceVariant),
                ),
              ),
          ] else
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: cs.primary.withValues(alpha: 0.25)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.lock_outline, color: cs.primary),
                      const SizedBox(width: 8),
                      Text(
                        'Contact info hidden',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Subscribe to Pro-Networx to view email, phone, and direct booking links.',
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: cs.onSurfaceVariant),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _openSubscribe,
                    child: const Text('Subscribe'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
