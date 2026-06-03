import 'package:flutter/material.dart';

import '../../core/services/refinery_service.dart';
import '../../core/theme/networx_extensions.dart';

/// Artist-facing aggregated Refinery review analytics for a single song.
/// Mirrors the web `/refinery/analytics/[songId]` page: progress to minimum,
/// rating averages, survey distributions, custom questions, and individual
/// reviews. Auto-refreshes while reviews are still coming in.
class RefineryAnalyticsScreen extends StatefulWidget {
  const RefineryAnalyticsScreen({super.key, required this.songId});

  final String songId;

  @override
  State<RefineryAnalyticsScreen> createState() =>
      _RefineryAnalyticsScreenState();
}

class _RefineryAnalyticsScreenState extends State<RefineryAnalyticsScreen> {
  static const List<({String key, String question})> _ratingQuestions = [
    (key: 'overall_rating', question: 'Overall'),
    (key: 'beat_rating', question: 'Beat / instrumental'),
    (key: 'lyrics_rating', question: 'Lyrics'),
    (key: 'chorus_rating', question: 'Chorus / hook'),
    (key: 'opening_ending_rating', question: 'Opening & ending'),
  ];

  static const List<({String key, String question, List<String> options})>
      _surveyQuestions = [
    (key: 'vocals_clear', question: 'Was the voice clear?', options: ['Yes', 'Somewhat', 'No']),
    (key: 'flow_quality', question: 'Flow and delivery', options: ['Smooth', 'Average', 'Choppy']),
    (key: 'intro_hook', question: 'Did the intro hook you?', options: ['Yes', 'No']),
    (key: 'listen_again', question: 'Would you listen again?', options: ['Yes', 'Maybe', 'No']),
    (key: 'add_to_playlist', question: 'Add to a playlist?', options: ['Yes', 'Maybe', 'No']),
    (key: 'memorable_hook', question: 'Memorable hook or chorus?', options: ['Yes', 'Somewhat', 'No']),
    (key: 'audio_quality', question: 'Mixing / audio quality', options: ['Yes', 'Needs Work', 'No']),
    (key: 'recommend_friend', question: 'Recommend to a friend?', options: ['Yes', 'Maybe', 'No']),
  ];

  final RefineryService _service = RefineryService();
  RefineryAnalytics? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _service.getAnalytics(widget.songId, limit: 100);
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load analytics.';
        _loading = false;
      });
    }
  }

  String _fmt(double? v) =>
      v == null ? '—' : (v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(1));

  void _applyReviewUpdate(RefineryReviewItem updated) {
    final data = _data;
    if (data == null) return;
    final idx = data.reviews.indexWhere((x) => x.id == updated.id);
    if (idx < 0) return;
    setState(() {
      data.reviews[idx] = updated;
      // Favorited reviews float to the top (newest-first within each group).
      data.reviews.sort((a, b) {
        final af = a.favorited ? 1 : 0;
        final bf = b.favorited ? 1 : 0;
        if (af != bf) return bf - af;
        return b.createdAt.compareTo(a.createdAt);
      });
    });
  }

  Future<void> _toggleFavorite(RefineryReviewItem r) async {
    final next = !r.favorited;
    _applyReviewUpdate(r.copyWith(favorited: next));
    try {
      await _service.favoriteReview(widget.songId, r.id, next);
    } catch (_) {
      _applyReviewUpdate(r.copyWith(favorited: !next));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update favorite.')),
        );
      }
    }
  }

  Future<void> _rateQuality(RefineryReviewItem r, int n) async {
    // Tapping the current rating again clears it.
    final next = r.qualityRating == n ? null : n;
    _applyReviewUpdate(
      next == null ? r.copyWith(clearQuality: true) : r.copyWith(qualityRating: next),
    );
    try {
      await _service.rateReviewQuality(widget.songId, r.id, next);
    } catch (_) {
      _applyReviewUpdate(
        r.qualityRating == null
            ? r.copyWith(clearQuality: true)
            : r.copyWith(qualityRating: r.qualityRating),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update rating.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review analytics'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _buildBody(surfaces, scheme),
    );
  }

  Widget _buildBody(NetworxSurfaces surfaces, ColorScheme scheme) {
    if (_loading && _data == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final data = _data;
    if (data == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error ?? 'No analytics available.'),
            const SizedBox(height: 8),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    final progress = data.minReviews <= 0
        ? 0.0
        : (data.reviewCount / data.minReviews).clamp(0.0, 1.0);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _header(data, surfaces, scheme),
          const SizedBox(height: 16),
          _progressCard(data, progress, surfaces, scheme),
          const SizedBox(height: 16),
          _sectionTitle('Rating averages'),
          const SizedBox(height: 8),
          ..._ratingQuestions.map((q) {
            final stats = data.ratingStats[q.key];
            final pct = (stats?.mean ?? 0) / 10.0;
            return _ratingBar(q.question, stats, pct, surfaces, scheme);
          }),
          const SizedBox(height: 16),
          _sectionTitle('Survey responses'),
          const SizedBox(height: 8),
          ..._surveyQuestions.map(
              (q) => _surveyBlock(q, data, surfaces, scheme)),
          if (data.customQuestions.isNotEmpty) ...[
            const SizedBox(height: 16),
            _sectionTitle('Your custom questions'),
            const SizedBox(height: 8),
            ...data.customQuestions.map(
                (cq) => _customQuestionBlock(cq, surfaces)),
          ],
          const SizedBox(height: 16),
          _sectionTitle('Individual reviews (${data.totalReviews})'),
          const SizedBox(height: 8),
          if (data.reviews.isEmpty)
            Text(
              'No reviews yet. They will appear here as listeners submit them.',
              style: TextStyle(color: surfaces.textSecondary),
            )
          else
            ...data.reviews.map((r) => _reviewCard(r, surfaces, scheme)),
        ],
      ),
    );
  }

  Widget _header(
      RefineryAnalytics data, NetworxSurfaces surfaces, ColorScheme scheme) {
    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: (data.artworkUrl != null && data.artworkUrl!.isNotEmpty)
              ? Image.network(
                  data.artworkUrl!,
                  width: 56,
                  height: 56,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) =>
                      _artFallback(surfaces),
                )
              : _artFallback(surfaces),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.songTitle,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                data.artistName,
                style: TextStyle(color: surfaces.textSecondary),
              ),
            ],
          ),
        ),
        Chip(
          label: Text(data.inRefinery ? 'In Refinery' : 'Completed'),
          visualDensity: VisualDensity.compact,
        ),
      ],
    );
  }

  Widget _artFallback(NetworxSurfaces surfaces) {
    return Container(
      width: 56,
      height: 56,
      color: surfaces.textSecondary.withValues(alpha: 0.12),
      child: const Icon(Icons.music_note, size: 24),
    );
  }

  Widget _progressCard(RefineryAnalytics data, double progress,
      NetworxSurfaces surfaces, ColorScheme scheme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Progress to minimum',
                    style: TextStyle(color: surfaces.textSecondary)),
                Text('${data.reviewCount} / ${data.minReviews} reviews',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                backgroundColor: scheme.surfaceContainerHighest,
              ),
            ),
            if (data.outlierCount > 0) ...[
              const SizedBox(height: 8),
              Text(
                '${data.outlierCount} outlier${data.outlierCount == 1 ? '' : 's'} flagged (rating >2σ from the mean).',
                style: TextStyle(color: surfaces.textMuted, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
    );
  }

  Widget _ratingBar(String label, RefineryRatingStats? stats, double pct,
      NetworxSurfaces surfaces, ColorScheme scheme) {
    final meta = StringBuffer('${_fmt(stats?.mean)} avg');
    if (stats?.median != null) meta.write(' · ${_fmt(stats!.median)} median');
    if (stats?.stddev != null) meta.write(' · σ ${_fmt(stats!.stddev)}');
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(child: Text(label)),
              Text(meta.toString(),
                  style: TextStyle(color: surfaces.textSecondary, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct.clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: scheme.surfaceContainerHighest,
            ),
          ),
        ],
      ),
    );
  }

  Widget _surveyBlock(
      ({String key, String question, List<String> options}) q,
      RefineryAnalytics data,
      NetworxSurfaces surfaces,
      ColorScheme scheme) {
    final dist = data.surveyDistributions[q.key] ?? const {};
    final total =
        q.options.fold<int>(0, (acc, opt) => acc + (dist[opt] ?? 0));
    if (total == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q.question,
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          ...q.options.map((opt) {
            final count = dist[opt] ?? 0;
            final pct = total > 0 ? count / total : 0.0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(opt,
                          style: TextStyle(
                              color: surfaces.textSecondary, fontSize: 12)),
                      Text('$count (${(pct * 100).round()}%)',
                          style: TextStyle(
                              color: surfaces.textSecondary, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 6,
                      backgroundColor: scheme.surfaceContainerHighest,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _customQuestionBlock(
      RefineryCustomQuestionSummary cq, NetworxSurfaces surfaces) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(cq.questionText,
              style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(
            '${cq.totalResponses} response${cq.totalResponses == 1 ? '' : 's'}',
            style: TextStyle(color: surfaces.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 4),
          if (cq.recentResponses.isEmpty)
            Text('No answers yet.',
                style: TextStyle(color: surfaces.textMuted, fontSize: 12))
          else
            ...cq.recentResponses.map(
              (r) => Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text('• $r',
                    style: TextStyle(color: surfaces.textSecondary)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _reviewCard(
      RefineryReviewItem r, NetworxSurfaces surfaces, ColorScheme scheme) {
    final ratings = <({String label, int value})>[
      (label: 'overall', value: r.overallRating),
      (label: 'beat', value: r.beatRating),
      (label: 'lyrics', value: r.lyricsRating),
      (label: 'chorus', value: r.chorusRating),
      (label: 'intro/outro', value: r.openingEndingRating),
    ];
    const amber = Color(0xFFF59E0B);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: r.favorited
          ? RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: const BorderSide(color: amber, width: 1.5),
            )
          : null,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(r.createdAt,
                      style: TextStyle(
                          color: surfaces.textMuted, fontSize: 12)),
                ),
                if (r.isOutlier)
                  Chip(
                    label: const Text('Outlier'),
                    visualDensity: VisualDensity.compact,
                    backgroundColor: scheme.errorContainer,
                  ),
                IconButton(
                  tooltip: r.favorited ? 'Remove favorite' : 'Favorite',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    r.favorited ? Icons.star : Icons.star_border,
                    color: r.favorited ? amber : surfaces.textMuted,
                  ),
                  onPressed: () => _toggleFavorite(r),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: ratings
                  .map((m) => Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: scheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('${m.label}  ${m.value}',
                            style: const TextStyle(fontSize: 12)),
                      ))
                  .toList(),
            ),
            if (r.comment != null) ...[
              const SizedBox(height: 8),
              Text('“${r.comment}”',
                  style: const TextStyle(fontStyle: FontStyle.italic)),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Text('Feedback quality:',
                    style: TextStyle(
                        color: surfaces.textSecondary, fontSize: 12)),
                const SizedBox(width: 4),
                ...List.generate(5, (i) {
                  final n = i + 1;
                  final filled = (r.qualityRating ?? 0) >= n;
                  return GestureDetector(
                    onTap: () => _rateQuality(r, n),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Icon(
                        filled ? Icons.star : Icons.star_border,
                        size: 20,
                        color: filled ? amber : surfaces.textMuted,
                      ),
                    ),
                  );
                }),
                if (r.qualityRating != null) ...[
                  const SizedBox(width: 4),
                  Text('${r.qualityRating}/5',
                      style: TextStyle(
                          color: surfaces.textSecondary, fontSize: 12)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
