import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../messages/messages_screen.dart';

class ProNetworxProfileScreen extends StatefulWidget {
  final String userId;
  const ProNetworxProfileScreen({super.key, required this.userId});

  @override
  State<ProNetworxProfileScreen> createState() => _ProNetworxProfileScreenState();
}

class _ProNetworxProfileScreenState extends State<ProNetworxProfileScreen> {
  final ProNetworxService _service = ProNetworxService();
  bool _loading = true;
  Map<String, dynamic>? _profile;
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
      final p = await _service.getProfileByUserId(widget.userId);
      if (!mounted) return;
      setState(() {
        _myUserId = me?.id;
        _profile = p;
      });
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
              border: Border.all(color: Colors.white.withValues(alpha: surfaces.glassBorderOpacity)),
              boxShadow: surfaces.glassShadow,
              borderRadius: BorderRadius.circular(18),
            ),
            padding: const EdgeInsets.all(14),
            child: child,
          ),
        ),
      );
    }

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null || _profile == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('PRO‑NETWORX')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(_error ?? 'Failed to load profile', style: TextStyle(color: surfaces.textSecondary)),
          ),
        ),
      );
    }

    final p = _profile!;
    final displayName = (p['displayName'] ?? p['display_name'] ?? 'Catalyst').toString();
    final headline = (p['headline'] ?? '').toString();
    final bio = (p['bio'] ?? '').toString();
    final location = (p['locationRegion'] ?? p['location_region'] ?? '').toString();
    final avatar = (p['avatarUrl'] ?? p['avatar_url'] ?? '').toString();
    final skills = (p['skills'] is List) ? (p['skills'] as List).map((e) => e.toString()).toList() : <String>[];
    final serviceTitle = (p['serviceTitle'] ?? p['service_title'] ?? p['skillsHeadline'] ?? p['skills_headline'] ?? '').toString();
    final mediaUrl = (p['mediaPreviewUrl'] ?? p['media_preview_url'] ?? '').toString();
    final mentor = p['mentorOptIn'] == true || p['mentor_opt_in'] == true;
    final available = p['availableForWork'] == true || p['available_for_work'] == true;
    final listings = (p['listings'] is List) ? (p['listings'] as List) : const [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sync‑Profile'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Wake banner (media preview)
          glass(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Wake', style: Theme.of(context).textTheme.labelSmall?.copyWith(color: surfaces.textMuted)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 16 / 9,
                    child: mediaUrl.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: mediaUrl,
                            fit: BoxFit.cover,
                            errorWidget: (context, url, error) => Container(
                              decoration: BoxDecoration(gradient: surfaces.signatureGradient),
                              alignment: Alignment.center,
                              child: const Icon(Icons.auto_awesome),
                            ),
                          )
                        : Container(
                            decoration: BoxDecoration(gradient: surfaces.signatureGradient),
                            alignment: Alignment.center,
                            child: const Icon(Icons.auto_awesome),
                          ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          glass(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: surfaces.elevated,
                  backgroundImage: avatar.isNotEmpty ? CachedNetworkImageProvider(avatar) : null,
                  child: avatar.isEmpty ? const Icon(Icons.person_outline) : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontFamily: 'SpaceGrotesk'),
                            ),
                          ),
                          if (available)
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
                      if (headline.trim().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(headline, style: TextStyle(color: surfaces.textSecondary)),
                      ],
                      if (location.trim().isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(location, style: TextStyle(color: surfaces.textMuted, fontSize: 12)),
                      ],
                      if (serviceTitle.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          serviceTitle,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontFamily: 'Lora'),
                        ),
                      ],
                      if (bio.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(bio, style: TextStyle(color: surfaces.textSecondary)),
                      ],
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (mentor)
                            _Pill(text: 'Mentor', color: scheme.primary, border: scheme.primary.withValues(alpha: 0.35), fill: scheme.primary.withValues(alpha: 0.10)),
                          ...skills.take(10).map((s) => _Pill(text: s, color: surfaces.textSecondary, border: surfaces.border)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _myUserId == null ? null : () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ThreadScreen(
                                  myUserId: _myUserId!,
                                  otherUserId: (p['userId'] ?? p['user_id'] ?? widget.userId).toString(),
                                  otherDisplayName: displayName,
                                ),
                              ),
                            );
                          },
                          icon: const Icon(Icons.mail_outline),
                          label: const Text('Direct Message'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),
          Text('Service menu', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (listings.isEmpty)
            Text('No services listed yet.', style: TextStyle(color: surfaces.textSecondary))
          else
            glass(
              child: Column(
                children: listings.map((l) {
                  final m = (l is Map) ? l.map((k, v) => MapEntry(k.toString(), v)) : <String, dynamic>{};
                  final title = (m['title'] ?? 'Service').toString();
                  final desc = (m['description'] ?? '').toString();
                  final cents = m['rateCents'] ?? m['rate_cents'];
                  final price = cents == null ? '—' : '\$${((cents as num) / 100).toStringAsFixed(2)}';
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                              if (desc.trim().isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(desc, style: TextStyle(color: surfaces.textSecondary)),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text(price, style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  );
                }).toList(),
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
        border: Border.all(color: border),
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

