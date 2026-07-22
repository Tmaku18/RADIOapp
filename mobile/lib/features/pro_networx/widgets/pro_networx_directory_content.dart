import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_assets.dart';
import '../../../core/models/pro_networx_models.dart';
import '../../../core/navigation/app_routes.dart';
import '../../../core/services/pro_networx_service.dart';
import '../../../core/services/users_service.dart';
import '../../../core/theme/dimension_tokens.dart';
import '../../../widgets/dimension/dimension_widgets.dart';

const _pageSize = 24;

/// Mobile port of web [ProNetworxDirectoryContent].
class ProNetworxDirectoryContent extends StatefulWidget {
  const ProNetworxDirectoryContent({
    super.key,
    this.title = 'Directory',
    this.subtitle = 'Find Producers by skill, availability, and location.',
    this.showEditProfile = true,
    this.smartRanking = false,
  });

  final String title;
  final String subtitle;
  final bool showEditProfile;
  final bool smartRanking;

  @override
  State<ProNetworxDirectoryContent> createState() =>
      _ProNetworxDirectoryContentState();
}

class _ProNetworxDirectoryContentState extends State<ProNetworxDirectoryContent> {
  final ProNetworxService _proService = ProNetworxService();
  final UsersService _usersService = UsersService();
  final TextEditingController _search = TextEditingController();
  final TextEditingController _location = TextEditingController();
  final TextEditingController _skill = TextEditingController();

  List<ProDirectoryItem> _allItems = [];
  List<ProDirectoryItem> _visibleItems = [];
  int _total = 0;
  int _offset = 0;
  bool _hasMore = false;
  bool _loading = true;
  bool _loadingMore = false;
  String? _loadError;
  bool _availableOnly = false;
  late bool _randomMode = !widget.smartRanking;
  late String _randomSeed = DateTime.now().millisecondsSinceEpoch.toString();
  final Set<String> _followBusy = {};

  String? _myUserId;

  @override
  void initState() {
    super.initState();
    _resolveMyUserId();
    _load(reset: true);
  }

  @override
  void dispose() {
    _search.dispose();
    _location.dispose();
    _skill.dispose();
    super.dispose();
  }

  Future<void> _resolveMyUserId() async {
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      final profile = await auth.getUserProfile();
      if (mounted) setState(() => _myUserId = profile?.id);
    } catch (_) {}
  }

  String get _mode {
    if (_randomMode) return 'random';
    if (widget.smartRanking) return 'smart';
    return 'default';
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _loadError = null;
        _offset = 0;
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final res = await _proService.listDirectory(
        search: _search.text.trim().isEmpty ? null : _search.text.trim(),
        location: _location.text.trim().isEmpty ? null : _location.text.trim(),
        skill: _skill.text.trim().isEmpty
            ? null
            : _skill.text.trim().toLowerCase().replaceAll(' ', '_'),
        availableForWork: _availableOnly ? true : null,
        sort: 'desc',
        mode: _mode,
        seed: _randomMode ? _randomSeed : null,
      );

      if (!mounted) return;
      setState(() {
        _allItems = res.items;
        _total = res.total;
        if (reset) {
          _visibleItems = _allItems.take(_pageSize).toList();
          _offset = _visibleItems.length;
        } else {
          final next = _allItems.skip(_offset).take(_pageSize).toList();
          _visibleItems = [..._visibleItems, ...next];
          _offset += next.length;
        }
        _hasMore = _offset < _allItems.length;
        _loadError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (reset) {
          _allItems = [];
          _visibleItems = [];
          _total = 0;
          _loadError =
              'Could not load catalysts. Check your connection and try again.';
        }
        _hasMore = false;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _toggleFollow(ProDirectoryItem item) async {
    if (_followBusy.contains(item.userId)) return;
    setState(() => _followBusy.add(item.userId));

    final wasFollowing = item.isFollowing;
    _patchItem(item.userId, isFollowing: !wasFollowing);

    try {
      if (wasFollowing) {
        await _usersService.unfollow(item.userId);
      } else {
        await _usersService.follow(item.userId);
      }
    } catch (_) {
      if (mounted) _patchItem(item.userId, isFollowing: wasFollowing);
    } finally {
      if (mounted) setState(() => _followBusy.remove(item.userId));
    }
  }

  void _patchItem(String userId, {required bool isFollowing}) {
    setState(() {
      _allItems = _allItems
          .map((i) =>
              i.userId == userId ? i.copyWith(isFollowing: isFollowing) : i)
          .toList();
      _visibleItems = _visibleItems
          .map((i) =>
              i.userId == userId ? i.copyWith(isFollowing: isFollowing) : i)
          .toList();
    });
  }

  void _clearFilters() {
    _search.clear();
    _location.clear();
    _skill.clear();
    setState(() => _availableOnly = false);
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          DimensionReveal(
            child: Column(
              children: [
                Text(
                  widget.smartRanking ? '◤ PRO-NETWORX · HOME' : '◤ PRO-NETWORX · DIRECTORY',
                  style: DimensionTypography.monoCaps(
                    color: DimensionTokens.neonYellow,
                    fontSize: 10,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                _DirectoryTitle(title: widget.title),
                const SizedBox(height: 8),
                Text(
                  widget.subtitle,
                  textAlign: TextAlign.center,
                  style: DimensionTypography.body(),
                ),
                if (widget.showEditProfile) ...[
                  const SizedBox(height: 16),
                  DimensionCtaButton(
                    label: 'Create / edit my profile',
                    onPressed: () => Navigator.of(context).pushNamed(
                      AppRoutes.proMeProfile,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          DimensionReveal(
            delay: const Duration(milliseconds: 80),
            child: GlassCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _search,
                    decoration: const InputDecoration(
                      labelText: 'Search name or headline',
                      hintText: 'Producer, designer…',
                    ),
                    onSubmitted: (_) => _load(reset: true),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _location,
                    decoration: const InputDecoration(
                      labelText: 'Location (region)',
                    ),
                    onSubmitted: (_) => _load(reset: true),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _skill,
                    decoration: const InputDecoration(
                      labelText: 'Skill',
                      hintText: 'producer, studio…',
                    ),
                    onSubmitted: (_) => _load(reset: true),
                  ),
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      'Available for work',
                      style: DimensionTypography.bodyPrimary(fontSize: 14),
                    ),
                    value: _availableOnly,
                    onChanged: (v) {
                      setState(() => _availableOnly = v);
                    },
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      'Random profiles',
                      style: DimensionTypography.bodyPrimary(fontSize: 14),
                    ),
                    value: _randomMode,
                    onChanged: (v) {
                      setState(() => _randomMode = v);
                    },
                  ),
                  if (_randomMode)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () {
                          setState(() {
                            _randomSeed =
                                DateTime.now().millisecondsSinceEpoch.toString();
                          });
                          _load(reset: true);
                        },
                        child: const Text('Shuffle'),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      DimensionCtaButton(
                        label: 'Apply filters',
                        onPressed: _loading ? null : () => _load(reset: true),
                      ),
                      DimensionCtaButton(
                        label: 'Clear',
                        variant: DimensionCtaVariant.secondary,
                        onPressed: _loading ? null : _clearFilters,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          if (_loadError != null && !_loading)
            GlassCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Text(_loadError!, style: DimensionTypography.body()),
                  const SizedBox(height: 12),
                  DimensionCtaButton(
                    label: 'Retry',
                    variant: DimensionCtaVariant.secondary,
                    onPressed: () => _load(reset: true),
                  ),
                ],
              ),
            ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_loadError == null) ...[
            Text(
              '$_total RESULTS',
              style: DimensionTypography.monoCaps(fontSize: 11),
            ),
            const SizedBox(height: 12),
            if (_visibleItems.isEmpty)
              GlassCard(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Text(
                      'No matches',
                      style: DimensionTypography.cardTitle(fontSize: 20),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Try widening your filters.',
                      style: DimensionTypography.body(),
                    ),
                  ],
                ),
              )
            else
              ...List.generate(_visibleItems.length, (i) {
                final item = _visibleItems[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: DimensionReveal(
                    delay: Duration(milliseconds: (i % 6) * 50),
                    offsetY: 24,
                    child: _DirectoryCard(
                      item: item,
                      myUserId: _myUserId,
                      followBusy: _followBusy.contains(item.userId),
                      onFollow: () => _toggleFollow(item),
                      onProfile: () => Navigator.of(context).pushNamed(
                        AppRoutes.proProfile,
                        arguments: item.userId,
                      ),
                      onMessage: _myUserId == null
                          ? null
                          : () => Navigator.of(context).pushNamed(
                                AppRoutes.thread,
                                arguments: {
                                  'myUserId': _myUserId!,
                                  'otherUserId': item.userId,
                                  'otherDisplayName':
                                      item.displayName ?? 'Creator',
                                },
                              ),
                    ),
                  ),
                );
              }),
            if (_hasMore && _visibleItems.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                  child: DimensionCtaButton(
                    label: _loadingMore ? 'Loading…' : 'Load more',
                    variant: DimensionCtaVariant.secondary,
                    onPressed:
                        _loadingMore ? null : () => _load(reset: false),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _DirectoryTitle extends StatelessWidget {
  const _DirectoryTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    final words = title.trim().split(RegExp(r'\s+'));
    if (words.isEmpty) return const SizedBox.shrink();
    final last = words.removeLast();
    final rest = words.join(' ');
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: rest.isEmpty ? '' : '$rest ',
            style: DimensionTypography.pageTitle(fontSize: 28),
          ),
          TextSpan(
            text: last,
            style: DimensionTypography.accentCyan(fontSize: 28),
          ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}

class _DirectoryCard extends StatelessWidget {
  const _DirectoryCard({
    required this.item,
    required this.myUserId,
    required this.followBusy,
    required this.onFollow,
    required this.onProfile,
    required this.onMessage,
  });

  final ProDirectoryItem item;
  final String? myUserId;
  final bool followBusy;
  final VoidCallback onFollow;
  final VoidCallback onProfile;
  final VoidCallback? onMessage;

  @override
  Widget build(BuildContext context) {
    final cardTitle = (item.serviceTitle ??
            (item.skills.isNotEmpty ? item.skills.first : null) ??
            (item.role == 'service_provider' ? 'Service' : 'Artist'))
        .replaceAll('_', ' ');
    final subtitle =
        item.currentTitle ?? item.skillsHeadline ?? item.headline ?? '—';
    final preview = item.mediaPreviewUrl?.trim();
    final isSelf = myUserId != null && myUserId == item.userId;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (preview != null &&
              preview.isNotEmpty &&
              item.mediaPreviewType == 'image')
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: CachedNetworkImage(
                  imageUrl: preview,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => _FallbackPreview(userId: item.userId),
                ),
              ),
            )
          else
            _FallbackPreview(userId: item.userId),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      cardTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: DimensionTypography.cardTitle(fontSize: 16),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: DimensionTypography.monoCaps(fontSize: 10),
                    ),
                  ],
                ),
              ),
              if (item.verifiedCatalyst)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: DimensionTokens.neonYellow.withValues(alpha: 0.4),
                    ),
                    color: DimensionTokens.neonYellow.withValues(alpha: 0.12),
                  ),
                  child: Text(
                    'Verified',
                    style: DimensionTypography.monoCaps(
                      color: DimensionTokens.neonYellow,
                      fontSize: 9,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: DimensionTokens.bgSurface,
                backgroundImage: (item.avatarUrl ?? '').isNotEmpty
                    ? CachedNetworkImageProvider(item.avatarUrl!)
                    : null,
                child: (item.avatarUrl ?? '').isEmpty
                    ? Text(
                        '✦',
                        style: DimensionTypography.accentCyan(fontSize: 18),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          item.displayName ?? 'Unnamed',
                          style: DimensionTypography.bodyPrimary(
                            fontSize: 15,
                          ).copyWith(fontWeight: FontWeight.w600),
                        ),
                        if (item.availableForWork)
                          _Badge(label: 'Available', color: DimensionTokens.cyan300),
                        if (item.mentorOptIn)
                          _Badge(label: 'Mentor', color: DimensionTokens.pink400),
                      ],
                    ),
                    if ((item.locationRegion ?? '').isNotEmpty)
                      Text(
                        item.locationRegion!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: DimensionTypography.bodyMuted(fontSize: 12),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (item.skills.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: item.skills
                  .take(5)
                  .map(
                    (s) => _Badge(
                      label: s.replaceAll('_', ' '),
                      color: DimensionTokens.textMuted,
                      outline: true,
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 10),
          Text.rich(
            TextSpan(
              text: 'Starting at ',
              style: DimensionTypography.bodyMuted(fontSize: 13),
              children: [
                TextSpan(
                  text: _formatStartingAt(
                    item.startingAtCents,
                    item.startingAtRateType,
                  ),
                  style: DimensionTypography.accentCyan(fontSize: 14),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              DimensionCtaButton(
                label: 'View profile',
                variant: DimensionCtaVariant.secondary,
                onPressed: onProfile,
              ),
              if (isSelf)
                DimensionCtaButton(
                  label: 'You',
                  variant: DimensionCtaVariant.secondary,
                  onPressed: null,
                )
              else
                DimensionCtaButton(
                  label: followBusy
                      ? '...'
                      : (item.isFollowing ? 'Following' : 'Follow'),
                  variant: item.isFollowing
                      ? DimensionCtaVariant.secondary
                      : DimensionCtaVariant.pink,
                  onPressed: followBusy ? null : onFollow,
                ),
              if (onMessage != null)
                DimensionCtaButton(
                  label: 'Message',
                  onPressed: onMessage,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FallbackPreview extends StatelessWidget {
  const _FallbackPreview({required this.userId});
  final String userId;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.black.withValues(alpha: 0.8),
                DimensionTokens.cyan300.withValues(alpha: 0.15),
              ],
            ),
          ),
          child: Center(
            child: Image.asset(
              BrandAssets.logoCyanAsset,
              height: 72,
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.label,
    required this.color,
    this.outline = false,
  });

  final String label;
  final Color color;
  final bool outline;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: outline ? 0.35 : 0.5)),
        color: outline ? null : color.withValues(alpha: 0.12),
      ),
      child: Text(
        label.toUpperCase(),
        style: DimensionTypography.monoCaps(color: color, fontSize: 9),
      ),
    );
  }
}

String _formatStartingAt(int? cents, String? rateType) {
  if (cents == null) return 'Contact for pricing';
  final dollars = (cents / 100).toStringAsFixed(2);
  if (rateType == 'hourly') return '\$$dollars/hr';
  return '\$$dollars';
}
