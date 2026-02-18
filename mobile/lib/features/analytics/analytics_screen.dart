import 'package:flutter/material.dart';
import '../../core/models/analytics_models.dart';
import '../../core/services/analytics_service.dart';
import '../../core/services/credits_service.dart';
import '../../core/theme/networx_extensions.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  final AnalyticsService _analytics = AnalyticsService();
  final CreditsService _credits = CreditsService();

  bool _loading = true;
  ArtistAnalytics? _data;
  Map<String, dynamic> _balance = const {};
  Map<String, dynamic>? _playDetail;
  Map<String, dynamic>? _roi;
  List<Map<String, dynamic>> _regions = const [];
  String? _playIdFromRoute;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args = ModalRoute.of(context)?.settings.arguments;
    final playId = args is Map ? args['playId'] as String? : null;
    if (playId != null && playId != _playIdFromRoute) {
      _playIdFromRoute = playId;
      _loadPlayDetail(playId);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _loadPlayDetail(String playId) async {
    try {
      final detail = await _analytics.getPlayById(playId);
      if (mounted) setState(() => _playDetail = detail);
    } catch (_) {
      if (mounted) setState(() => _playDetail = null);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _credits.getBalance(),
        _analytics.getMyAnalytics(days: 30),
        _analytics.getMyRoi(days: 30),
        _analytics.getMyPlaysByRegion(days: 30),
      ]);
      if (!mounted) return;
      setState(() {
        _balance = results[0] as Map<String, dynamic>;
        _data = results[1] as ArtistAnalytics?;
        _roi = results[2] as Map<String, dynamic>?;
        _regions = (results[3] as List<Map<String, dynamic>>);
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_playDetail != null) ...[
                  _PlayDetailCard(play: _playDetail!),
                  const SizedBox(height: 16),
                ],
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Guaranteed Signals Remaining',
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          (_balance['balance'] ?? 0).toString(),
                          style: Theme.of(context)
                              .textTheme
                              .displaySmall
                              ?.copyWith(
                                color: scheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Plays we’ve promised your tracks',
                          style: TextStyle(color: surfaces.textMuted),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_data == null)
                  Text(
                    'No analytics yet.',
                    style: TextStyle(color: surfaces.textSecondary),
                  )
                else ...[
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.25,
                    children: [
                      _StatCard(
                        label: 'Discoveries',
                        value: _data!.totalPlays.toString(),
                      ),
                      _StatCard(
                        label: 'Songs',
                        value: _data!.totalSongs.toString(),
                      ),
                      _StatCard(
                        label: 'Likes',
                        value: _data!.totalLikes.toString(),
                      ),
                      _StatCard(
                        label: 'Credits Used',
                        value: _data!.totalCreditsUsed.toString(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ROI',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontFamily: 'Lora'),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _roi == null || _roi!['roi'] == null
                                ? '—'
                                : '${(_roi!['roi'] as num).toDouble().toStringAsFixed(1)}%',
                            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  color: scheme.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${_roi?['newFollowers'] ?? 0} new followers / ${_roi?['creditsSpentInWindow'] ?? 0} credits (last ${_roi?['days'] ?? 30}d)',
                            style: TextStyle(color: surfaces.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Listener Heatmap (by region)',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontFamily: 'Lora'),
                          ),
                          const SizedBox(height: 10),
                          if (_regions.isEmpty)
                            Text('No regional engagement data yet.',
                                style: TextStyle(color: surfaces.textSecondary))
                          else ...[
                            ..._regions.take(10).map((r) {
                              final region = (r['region'] ?? 'Unknown').toString();
                              final countRaw = r['count'] ?? 0;
                              final count = countRaw is int
                                  ? countRaw
                                  : int.tryParse(countRaw.toString()) ?? 0;
                              final maxRaw = _regions.first['count'] ?? 1;
                              final maxCount = maxRaw is int
                                  ? maxRaw
                                  : int.tryParse(maxRaw.toString()) ?? 1;
                              final pct = maxCount <= 0 ? 0.0 : (count / maxCount).clamp(0.0, 1.0);
                              return Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    SizedBox(
                                      width: 120,
                                      child: Text(
                                        region,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(color: surfaces.textSecondary),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(999),
                                        child: LinearProgressIndicator(
                                          minHeight: 6,
                                          value: pct,
                                          backgroundColor: scheme.onSurface.withValues(alpha: 0.10),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    SizedBox(
                                      width: 44,
                                      child: Text(
                                        '$count',
                                        textAlign: TextAlign.right,
                                        style: TextStyle(color: surfaces.textMuted),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                            if (_regions.length > 10)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text('Showing top 10 regions (last 30d).',
                                    style: TextStyle(color: surfaces.textMuted, fontSize: 12)),
                              ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Top Performing Songs',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontFamily: 'Lora'),
                          ),
                          const SizedBox(height: 10),
                          if (_data!.topSongs.isEmpty)
                            Text(
                              'No songs with discoveries yet.',
                              style: TextStyle(color: surfaces.textSecondary),
                            )
                          else
                            ..._data!.topSongs.take(10).toList().asMap().entries.map(
                              (e) {
                                final i = e.key;
                                final s = e.value;
                                return Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 8),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 28,
                                        height: 28,
                                        decoration: BoxDecoration(
                                          color: scheme.primary
                                              .withValues(alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(999),
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          '${i + 1}',
                                          style: TextStyle(
                                            color: scheme.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              s.title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w600),
                                            ),
                                            Text(
                                              '${s.totalPlays} discoveries · ${s.likeCount} likes',
                                              style: TextStyle(
                                                  color: surfaces.textSecondary,
                                                  fontSize: 12),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        '${s.creditsRemaining} left',
                                        style: TextStyle(
                                            color: surfaces.textMuted),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

/// Card showing a single play's analytics (from "Your song has been played" notification).
class _PlayDetailCard extends StatelessWidget {
  final Map<String, dynamic> play;

  const _PlayDetailCard({required this.play});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    final songTitle = play['songTitle'] as String? ?? 'Your song';
    final playedAt = play['playedAt'] as String?;
    final listenersStart = play['listenersAtStart'] as int? ?? 0;
    final listenersEnd = play['listenersAtEnd'] as int?;
    final netChange = play['netListenerChange'];
    final likesDuring = play['likesDuring'] as int? ?? 0;
    final commentsDuring = play['commentsDuring'] as int? ?? 0;
    final disconnectsDuring = play['disconnectsDuring'] as int? ?? 0;
    final profileClicksDuring = play['profileClicksDuring'] as int? ?? 0;

    String formatTime(String? iso) {
      if (iso == null) return '—';
      try {
        final d = DateTime.parse(iso);
        return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        return iso;
      }
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.play_circle_filled, color: scheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'This play',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontFamily: 'Lora',
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              songTitle,
              style: TextStyle(
                color: surfaces.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (playedAt != null) ...[
              const SizedBox(height: 4),
              Text(
                'Played at ${formatTime(playedAt)}',
                style: TextStyle(color: surfaces.textMuted, fontSize: 12),
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _MiniStat(label: 'Listeners', value: listenersStart.toString()),
                if (listenersEnd != null)
                  _MiniStat(
                    label: 'Listeners (end)',
                    value: listenersEnd.toString(),
                  ),
                if (netChange != null)
                  _MiniStat(
                    label: 'Net change',
                    value: (netChange as int) >= 0
                        ? '+$netChange'
                        : netChange.toString(),
                  ),
                _MiniStat(label: 'Likes', value: likesDuring.toString()),
                _MiniStat(label: 'Comments', value: commentsDuring.toString()),
                _MiniStat(
                  label: 'Disconnects',
                  value: disconnectsDuring.toString(),
                ),
                _MiniStat(
                  label: 'Profile clicks',
                  value: profileClicksDuring.toString(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: surfaces.elevated.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: TextStyle(color: surfaces.textMuted, fontSize: 11)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: surfaces.textSecondary)),
            const Spacer(),
            Text(
              value,
              style: Theme.of(context)
                  .textTheme
                  .headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

