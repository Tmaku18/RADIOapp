import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/models/pro_networx_models.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';
import 'pro_profile_screen.dart';
import 'pro_me_profile_screen.dart';

class ProNetworxDirectoryScreen extends StatefulWidget {
  const ProNetworxDirectoryScreen({super.key});

  @override
  State<ProNetworxDirectoryScreen> createState() => _ProNetworxDirectoryScreenState();
}

class _ProNetworxDirectoryScreenState extends State<ProNetworxDirectoryScreen> {
  final ProNetworxService _service = ProNetworxService();

  bool _loading = true;
  List<ProDirectoryItem> _items = const [];
  String? _error;

  final TextEditingController _search = TextEditingController();
  final TextEditingController _skill = TextEditingController();
  bool _availableOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _skill.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _service.listDirectory(
        search: _search.text.trim().isEmpty ? null : _search.text.trim(),
        skill: _skill.text.trim().isEmpty ? null : _skill.text.trim(),
        availableForWork: _availableOnly ? true : null,
        sort: 'desc',
      );
      if (!mounted) return;
      setState(() => _items = items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    Widget glass({required Widget child}) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: surfaces.glassBlur, sigmaY: surfaces.glassBlur),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: surfaces.glassBgOpacity),
              border: Border.all(color: scheme.primary.withValues(alpha: 0.22)),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            padding: const EdgeInsets.all(12),
            child: child,
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('PRO‑NETWORX Directory'),
        actions: [
          IconButton(
            tooltip: 'Build my profile',
            onPressed: () async {
              final changed = await Navigator.push<bool>(
                context,
                MaterialPageRoute(builder: (_) => const ProNetworxMeProfileScreen()),
              );
              if (changed == true && mounted) {
                _load();
              }
            },
            icon: const Icon(Icons.edit_note),
          ),
          IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: Column(
              children: [
                TextField(
                  controller: _search,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    labelText: 'Search',
                    hintText: 'Producer, studio, designer, photographer…',
                  ),
                  onSubmitted: (_) => _load(),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _skill,
                        decoration: const InputDecoration(
                          labelText: 'Skill',
                          hintText: 'mixing, mastering, graphic design…',
                        ),
                        onSubmitted: (_) => _load(),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      children: [
                        Switch(
                          value: _availableOnly,
                          onChanged: (v) {
                            setState(() => _availableOnly = v);
                            _load();
                          },
                        ),
                        Text('Available', style: TextStyle(color: surfaces.textMuted, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Text(_error!, style: TextStyle(color: surfaces.textSecondary)),
                        ),
                      )
                    : _items.isEmpty
                        ? Center(
                            child: Text('No results.', style: TextStyle(color: surfaces.textSecondary)),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            itemCount: _items.length,
                            separatorBuilder: (context, index) => const SizedBox(height: 10),
                            itemBuilder: (context, i) {
                              final p = _items[i];
                              final preview = (p.mediaPreviewUrl ?? '').trim().isEmpty ? null : p.mediaPreviewUrl!;
                              final title = (p.serviceTitle ?? p.skillsHeadline ?? p.headline ?? p.skills.firstOrNull ?? 'Service')
                                  .toString();
                              final name = p.displayName ?? 'Catalyst';
                              final price = p.startingAtCents == null
                                  ? null
                                  : '\$${(p.startingAtCents! / 100).toStringAsFixed(0)}';

                              return InkWell(
                                borderRadius: BorderRadius.circular(18),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => ProNetworxProfileScreen(userId: p.userId),
                                    ),
                                  );
                                },
                                child: glass(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          CircleAvatar(
                                            radius: 18,
                                            backgroundColor: surfaces.elevated,
                                            backgroundImage: (p.avatarUrl ?? '').isNotEmpty
                                                ? CachedNetworkImageProvider(p.avatarUrl!)
                                                : null,
                                            child: (p.avatarUrl ?? '').isEmpty
                                                ? const Icon(Icons.person_outline, size: 18)
                                                : null,
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  title,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                                        fontWeight: FontWeight.w700,
                                                      ),
                                                ),
                                                const SizedBox(height: 2),
                                                Text(
                                                  name,
                                                  maxLines: 1,
                                                  overflow: TextOverflow.ellipsis,
                                                  style: TextStyle(color: surfaces.textSecondary),
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (p.availableForWork)
                                            Container(
                                              width: 10,
                                              height: 10,
                                              decoration: BoxDecoration(
                                                color: scheme.secondary,
                                                shape: BoxShape.circle,
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: scheme.secondary.withValues(alpha: 0.35),
                                                    blurRadius: 12,
                                                  ),
                                                ],
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      if (preview != null) ...[
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(14),
                                          child: AspectRatio(
                                            aspectRatio: 16 / 9,
                                            child: CachedNetworkImage(
                                              imageUrl: preview,
                                              fit: BoxFit.cover,
                                              errorWidget: (context, url, error) => Container(
                                                decoration: BoxDecoration(gradient: surfaces.signatureGradient),
                                                alignment: Alignment.center,
                                                child: const Icon(Icons.auto_awesome),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                      ],
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          if ((p.locationRegion ?? '').trim().isNotEmpty)
                                            _Pill(
                                              text: p.locationRegion!.trim(),
                                              color: surfaces.textSecondary,
                                              border: surfaces.border,
                                            ),
                                          if (p.mentorOptIn)
                                            _Pill(
                                              text: 'Mentor',
                                              color: scheme.primary,
                                              border: scheme.primary.withValues(alpha: 0.35),
                                              fill: scheme.primary.withValues(alpha: 0.10),
                                            ),
                                          ...p.skills.take(4).map((s) => _Pill(
                                                text: s,
                                                color: surfaces.textSecondary,
                                                border: surfaces.border,
                                              )),
                                        ],
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          if (price != null)
                                            Text(
                                              'Starting at $price',
                                              style: TextStyle(
                                                color: scheme.primary,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            )
                                          else
                                            Text(' ', style: TextStyle(color: surfaces.textMuted)),
                                          const Spacer(),
                                          if (p.verifiedCatalyst)
                                            _Pill(
                                              text: 'Verified Catalyst',
                                              color: scheme.primary,
                                              border: scheme.primary.withValues(alpha: 0.35),
                                              fill: scheme.primary.withValues(alpha: 0.10),
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String text;
  final Color color;
  final Color border;
  final Color? fill;
  const _Pill({required this.text, required this.color, required this.border, this.fill});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border.withValues(alpha: 0.9)),
        color: fill,
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
      ),
    );
  }
}

extension _FirstOrNullX<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

