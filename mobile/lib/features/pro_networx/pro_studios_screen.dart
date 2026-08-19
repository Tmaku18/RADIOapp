import 'package:flutter/material.dart';

import '../../core/models/studio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/studio_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../nearby/nearby_people_screen.dart';
import '../studios/my_studio_screen.dart';

/// Pro-Networx Studios tab — directory plus Nearby (list / map).
class ProStudiosScreen extends StatefulWidget {
  const ProStudiosScreen({super.key, this.initialNearby = false});

  /// Open the Nearby section (used by the `/nearby-people` deep link).
  final bool initialNearby;

  @override
  State<ProStudiosScreen> createState() => _ProStudiosScreenState();
}

class _ProStudiosScreenState extends State<ProStudiosScreen>
    with SingleTickerProviderStateMixin {
  final StudioService _service = StudioService();
  final TextEditingController _query = TextEditingController();
  List<Studio> _items = const [];
  bool _loading = true;
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialNearby ? 1 : 0,
    );
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final items = await _service.list(
        search: _query.text.trim().isEmpty ? null : _query.text.trim(),
        limit: 80,
      );
      if (!mounted) return;
      setState(() => _items = items);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = const []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Directory'),
            Tab(text: 'Nearby'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              _buildDirectory(),
              const NearbyPeopleScreen(embedded: true, studiosOnly: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDirectory() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _query,
                  decoration: const InputDecoration(
                    hintText: 'Search studios',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: (_) => _load(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'New studio',
                onPressed: () => Navigator.of(context)
                    .push<bool>(
                      MaterialPageRoute(
                        builder: (_) => const StudioEditorScreen(),
                      ),
                    )
                    .then((saved) {
                      if (saved == true) _load();
                    }),
                icon: const Icon(Icons.add),
              ),
            ],
          ),
        ),
        if (_loading) const LinearProgressIndicator(),
        Expanded(
          child: _items.isEmpty && !_loading
              ? const Center(child: Text('No published studios yet.'))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: _items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    final s = _items[i];
                    return InkWell(
                      onTap: () => Navigator.pushNamed(
                        context,
                        AppRoutes.studioProfile,
                        arguments: s.id,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            AspectRatio(
                              aspectRatio: 16 / 7,
                              child: (s.heroImageUrl ?? '').isNotEmpty
                                  ? Image.network(
                                      s.heroImageUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, _, _) =>
                                          _fallbackBanner(),
                                    )
                                  : _fallbackBanner(),
                            ),
                            Container(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest,
                              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    s.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if ((s.tagline ?? '').isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(s.tagline!, maxLines: 2),
                                  ],
                                  if (s.startingAtLabel != null) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      s.startingAtLabel!,
                                      style: const TextStyle(
                                        color: NetworxTokens.electricCyan,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                  if ((s.hoursSummary ?? '').isNotEmpty ||
                                      s.locationLine.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        [
                                          if ((s.hoursSummary ?? '').isNotEmpty)
                                            s.hoursSummary,
                                          if ((s.city ?? '').isNotEmpty) s.city,
                                        ].whereType<String>().join(' · '),
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _fallbackBanner() {
    return ColoredBox(
      color: NetworxTokens.warning.withValues(alpha: 0.18),
      child: const Icon(
        Icons.apartment,
        color: NetworxTokens.warning,
        size: 40,
      ),
    );
  }
}
