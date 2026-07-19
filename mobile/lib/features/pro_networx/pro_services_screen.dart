import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/pro_networx_service.dart';

class ProServicesScreen extends StatefulWidget {
  const ProServicesScreen({super.key});

  @override
  State<ProServicesScreen> createState() => _ProServicesScreenState();
}

class _ProServicesScreenState extends State<ProServicesScreen> {
  final ProNetworxService _service = ProNetworxService();
  final TextEditingController _query = TextEditingController();
  String _serviceType = '';
  bool _loading = true;
  List<ProServiceListing> _items = [];
  int _total = 0;
  int _offset = 0;
  static const int _pageSize = 24;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    setState(() {
      if (reset) {
        _items = [];
        _offset = 0;
      }
      _loading = true;
    });
    try {
      final res = await _service.listServices(
        search: _query.text.trim().isEmpty ? null : _query.text.trim(),
        serviceType: _serviceType.isEmpty ? null : _serviceType,
        limit: _pageSize,
        offset: _offset,
      );
      if (!mounted) return;
      setState(() {
        if (reset) {
          _items = res.items;
        } else {
          _items.addAll(res.items);
        }
        _total = res.total;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _query,
                  onSubmitted: (_) => _load(reset: true),
                  decoration: const InputDecoration(
                    hintText: 'Search services…',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.tune),
                onPressed: _showFilterSheet,
              ),
              FilledButton.icon(
                onPressed: () => Navigator.of(context).pushNamed(
                  AppRoutes.proNetworxMyServices,
                ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('List'),
              ),
            ],
          ),
        ),
        Expanded(
          child: _loading && _items.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _items.isEmpty
                  ? Center(
                      child: Text(
                        'No services match your filters.',
                        style: theme.textTheme.bodyMedium,
                      ),
                    )
                  : ListView.builder(
                      itemCount: _items.length + 1,
                      itemBuilder: (_, i) {
                        if (i >= _items.length) {
                          if (_items.length < _total) {
                            return Padding(
                              padding: const EdgeInsets.all(12),
                              child: Center(
                                child: TextButton(
                                  onPressed: () {
                                    _offset += _pageSize;
                                    _load();
                                  },
                                  child: const Text('Load more'),
                                ),
                              ),
                            );
                          }
                          return const SizedBox.shrink();
                        }
                        return _ServiceCard(listing: _items[i]);
                      },
                    ),
        ),
      ],
    );
  }

  Future<void> _showFilterSheet() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      builder: (_) {
        const types = [
          MapEntry('', 'All'),
          MapEntry('graphic_design', 'Graphic design'),
          MapEntry('photography', 'Photography'),
          MapEntry('videography', 'Videography'),
          MapEntry('illustration', 'Illustration'),
          MapEntry('lyricist', 'Lyricist'),
          MapEntry('beat_maker', 'Beat maker'),
          MapEntry('mix_master', 'Mix & master'),
          MapEntry('other', 'Other'),
        ];
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: types
                .map(
                  (t) => ListTile(
                    title: Text(t.value),
                    trailing:
                        _serviceType == t.key ? const Icon(Icons.check) : null,
                    onTap: () => Navigator.of(context).pop(t.key),
                  ),
                )
                .toList(),
          ),
        );
      },
    );
    if (selected != null) {
      setState(() => _serviceType = selected);
      _load(reset: true);
    }
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.listing});
  final ProServiceListing listing;

  String _formatPrice() {
    final cents = listing.priceCents;
    if (cents == null || cents <= 0) return 'Contact for pricing';
    final dollars = (cents / 100).toStringAsFixed(2);
    final symbol = listing.currency.toUpperCase() == 'USD'
        ? '\$'
        : '${listing.currency} ';
    return '$symbol$dollars${listing.rateType == 'hourly' ? '/hr' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).pushNamed(
          AppRoutes.proNetworxServiceDetail,
          arguments: listing.id,
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundImage: listing.ownerAvatarUrl != null &&
                            listing.ownerAvatarUrl!.isNotEmpty
                        ? CachedNetworkImageProvider(listing.ownerAvatarUrl!)
                        : null,
                    backgroundColor: cs.surfaceContainerHighest,
                    child: (listing.ownerAvatarUrl == null ||
                            listing.ownerAvatarUrl!.isEmpty)
                        ? const Icon(Icons.brush, size: 18)
                        : null,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          listing.ownerDisplayName ?? 'Creator',
                          style: theme.textTheme.titleSmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if ((listing.ownerHeadline ?? '').isNotEmpty)
                          Text(
                            listing.ownerHeadline!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: cs.onSurfaceVariant,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                listing.title,
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if ((listing.description ?? '').isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  listing.description!,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: cs.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    _formatPrice(),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.of(context).pushNamed(
                      AppRoutes.proNetworxServiceDetail,
                      arguments: listing.id,
                    ),
                    child: const Text('View'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
