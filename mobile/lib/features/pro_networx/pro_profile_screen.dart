import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/pro_networx_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'widgets/pro_network_paywall_sheet.dart';

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
  List<ProFeedPost> _posts = const [];
  List<ProServiceListing> _services = const [];

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
      // Load portfolio + services in parallel; failures are non-fatal.
      final results = await Future.wait([
        _service.listUserPosts(widget.userId, limit: 24).catchError(
              (_) => (items: <ProFeedPost>[], nextCursor: null),
            ),
        _service.listServicesForUser(widget.userId).catchError(
              (_) => <ProServiceListing>[],
            ),
      ]);
      if (!mounted) return;
      setState(() {
        _posts = (results[0] as ({List<ProFeedPost> items, String? nextCursor}))
            .items;
        _services = results[1] as List<ProServiceListing>;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openResume(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  /// Resumes hold personal contact info, so non-subscribers are sent to the
  /// paywall instead of the file. On a successful subscribe we reload so the
  /// resume opens immediately.
  Future<void> _openResumeSubscribe() async {
    final ok = await ProNetworkPaywallSheet.show(
      context,
      title: 'Subscribe to view resume',
      description:
          "Resumes include contact info. Subscribe to Pro-Networx to open this creator's resume.",
    );
    if (ok == true) _load();
  }

  /// DMs are subscription-gated the same way as resumes.
  Future<void> _openMessageSubscribe() async {
    final ok = await ProNetworkPaywallSheet.show(
      context,
      title: 'Subscribe to send messages',
      description:
          'Direct messaging unlocks with a Pro-Networx subscription. Cancel anytime.',
    );
    if (ok == true) _load();
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
        appBar: AppBar(title: const Text('Pro-Networx')),
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
    final heroUrl = (p['heroImageUrl'] ?? p['hero_image_url'] ?? '').toString();
    final mediaUrl = (p['mediaPreviewUrl'] ?? p['media_preview_url'] ?? '').toString();
    final bannerUrl = heroUrl.isNotEmpty ? heroUrl : mediaUrl;
    final resumeUrl = (p['resumeUrl'] ?? p['resume_url'] ?? '').toString();
    final resumeLocked = p['resumeLocked'] == true || p['resume_locked'] == true;
    final messagingLocked =
        p['messagingLocked'] == true || p['messaging_locked'] == true;
    final mentor = p['mentorOptIn'] == true || p['mentor_opt_in'] == true;
    final available = p['availableForWork'] == true || p['available_for_work'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pro-Networx Profile'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: AspectRatio(
              aspectRatio: 16 / 6,
              child: bannerUrl.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: bannerUrl,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => Container(
                        decoration:
                            BoxDecoration(gradient: surfaces.signatureGradient),
                        alignment: Alignment.center,
                        child: const Icon(Icons.auto_awesome),
                      ),
                    )
                  : Container(
                      decoration:
                          BoxDecoration(gradient: surfaces.signatureGradient),
                      alignment: Alignment.center,
                      child: const Icon(Icons.auto_awesome),
                    ),
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
                              style: DimensionTypography.cardTitle(fontSize: 20),
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
                          style: DimensionTypography.cardTitle(fontSize: 16),
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
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _myUserId == null
                                  ? null
                                  : () {
                                      if (messagingLocked) {
                                        _openMessageSubscribe();
                                        return;
                                      }
                                      Navigator.pushNamed(
                                        context,
                                        AppRoutes.thread,
                                        arguments: {
                                          'myUserId': _myUserId!,
                                          'otherUserId': (p['userId'] ??
                                                  p['user_id'] ??
                                                  widget.userId)
                                              .toString(),
                                          'otherDisplayName': displayName,
                                        },
                                      );
                                    },
                              icon: Icon(
                                messagingLocked
                                    ? Icons.lock_outline
                                    : Icons.mail_outline,
                              ),
                              label: const Text('Message'),
                            ),
                          ),
                          if (resumeUrl.isNotEmpty || resumeLocked) ...[
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: resumeUrl.isNotEmpty
                                  ? () => _openResume(resumeUrl)
                                  : _openResumeSubscribe,
                              icon: Icon(
                                resumeUrl.isNotEmpty
                                    ? Icons.description_outlined
                                    : Icons.lock_outline,
                              ),
                              label: const Text('Resume'),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),
          Text('Services', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (_services.isEmpty)
            Text('No services listed yet.',
                style: TextStyle(color: surfaces.textSecondary))
          else
            glass(
              child: Column(
                children: _services.map((s) {
                  final price = s.priceCents == null
                      ? '\$—'
                      : '\$${(s.priceCents! / 100).toStringAsFixed(2)}';
                  return InkWell(
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppRoutes.proNetworxServiceDetail,
                      arguments: s.id,
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(s.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                if ((s.description ?? '').trim().isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(s.description!,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                          color: surfaces.textSecondary)),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text(price,
                              style: TextStyle(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

          const SizedBox(height: 18),
          Text('Portfolio', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          if (_posts.isEmpty)
            Text('No posts yet.',
                style: TextStyle(color: surfaces.textSecondary))
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 4,
                crossAxisSpacing: 4,
                childAspectRatio: 1,
              ),
              itemCount: _posts.length,
              itemBuilder: (context, i) {
                final post = _posts[i];
                final url = post.imageUrl;
                return InkWell(
                  onTap: () => Navigator.pushNamed(
                    context,
                    AppRoutes.proNetworxExploreDetail,
                    arguments: post.id,
                  ),
                  child: Container(
                    color: surfaces.elevated,
                    child: url.isEmpty
                        ? const Icon(Icons.image_outlined)
                        : CachedNetworkImage(
                            imageUrl: url,
                            fit: BoxFit.cover,
                            errorWidget: (context, _, _) =>
                                const Icon(Icons.broken_image_outlined),
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

