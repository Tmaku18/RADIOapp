import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/models/competition_models.dart';
import '../../core/services/competition_service.dart';
import '../../core/theme/networx_extensions.dart';

class CompetitionScreen extends StatefulWidget {
  const CompetitionScreen({super.key});

  @override
  State<CompetitionScreen> createState() => _CompetitionScreenState();
}

class _CompetitionScreenState extends State<CompetitionScreen> {
  final CompetitionService _service = CompetitionService();
  bool _loading = true;

  List<LeaderboardSong> _likes = const [];
  List<LeaderboardSong> _listens = const [];
  List<LeaderboardSong> _trial = const [];
  List<NewsItem> _news = const [];
  SpotlightToday? _today;
  List<SpotlightWeekDay> _week = const [];
  CurrentWeek? _currentWeek;
  List<BrowseLeaderboardCategory> _browseCats = const [];

  final TextEditingController _voteController = TextEditingController();
  List<String> _voteSongIds = <String>[];
  bool _voteSubmitting = false;
  String? _voteError;

  @override
  void initState() {
    super.initState();
    _load();
    _voteController.addListener(() {
      final raw = _voteController.text;
      final ids = raw
          .split(RegExp(r'[,\\s]+'))
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
      setState(() => _voteSongIds = ids);
    });
  }

  @override
  void dispose() {
    _voteController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _service.getLeaderboardSongs(by: 'likes', limit: 20),
        _service.getLeaderboardSongs(by: 'listens', limit: 20),
        _service.getUpvotesPerMinute(windowMinutes: 60, limit: 20),
        _service.getNewsPromotions(limit: 10),
        _service.getTodaySpotlight(),
        _service.getWeekSpotlight(),
        _service.getCurrentWeek(),
        _service.getBrowseLeaderboard(limitPerCategory: 5),
      ]);

      if (!mounted) return;
      setState(() {
        _likes = results[0] as List<LeaderboardSong>;
        _listens = results[1] as List<LeaderboardSong>;
        _trial = results[2] as List<LeaderboardSong>;
        _news = results[3] as List<NewsItem>;
        _today = results[4] as SpotlightToday?;
        _week = results[5] as List<SpotlightWeekDay>;
        _currentWeek = results[6] as CurrentWeek?;
        _browseCats = results[7] as List<BrowseLeaderboardCategory>;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openLink(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _submitVote() async {
    if (_voteSubmitting) return;
    if (_voteSongIds.length != 7) {
      setState(() => _voteError = 'Select exactly 7 songs (rank 1–7).');
      return;
    }

    setState(() {
      _voteSubmitting = true;
      _voteError = null;
    });
    try {
      await _service.vote(_voteSongIds);
      if (!mounted) return;
      setState(() {
        _voteController.text = '';
        _voteSongIds = <String>[];
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vote submitted.')),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _voteError = 'Vote failed: $e');
    } finally {
      if (mounted) setState(() => _voteSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Competition & Spotlight'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  decoration: BoxDecoration(
                    gradient: surfaces.signatureGradient,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: scheme.primary.withValues(alpha: 0.25),
                    ),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Competition & Spotlight',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontFamily: 'Lora'),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Leaderboards, gems, and the weekly Top 7 vote.',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(color: surfaces.textSecondary),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                if (_news.isNotEmpty) ...[
                  Text(
                    'Now Live',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontFamily: 'Lora'),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 44,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _news.length,
                      separatorBuilder: (_, index) => const SizedBox(width: 8),
                      itemBuilder: (context, i) {
                        final n = _news[i];
                        return ActionChip(
                          label: Text(n.title, overflow: TextOverflow.ellipsis),
                          onPressed:
                              n.linkUrl == null ? null : () => _openLink(n.linkUrl!),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                Row(
                  children: [
                    Expanded(
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    "Today's Spotlight",
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontFamily: 'Lora'),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      border:
                                          Border.all(color: surfaces.roseGold),
                                      color: surfaces.roseGold
                                          .withValues(alpha: 0.12),
                                    ),
                                    child: Text(
                                      'Featured',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelSmall
                                          ?.copyWith(
                                            color: surfaces.roseGold,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: 0.3,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              if (_currentWeek != null)
                                Text(
                                  'Week ${_currentWeek!.periodStart} – ${_currentWeek!.periodEnd} · Voting ${_currentWeek!.votingOpen ? 'open' : 'closed'}',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.copyWith(color: surfaces.textMuted),
                                ),
                              const SizedBox(height: 10),
                              if (_today == null)
                                Text(
                                  'No spotlight set for today.',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(color: surfaces.textSecondary),
                                )
                              else
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('🎤', style: TextStyle(fontSize: 28)),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _today!.artistName,
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                    fontWeight:
                                                        FontWeight.w600),
                                          ),
                                          if (_today!.songTitle != null)
                                            Text(
                                              _today!.songTitle!,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall
                                                  ?.copyWith(
                                                      color: surfaces
                                                          .textSecondary),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "This week's lineup",
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontFamily: 'Lora'),
                        ),
                        const SizedBox(height: 8),
                        if (_week.isEmpty)
                          Text(
                            'No lineup for this week yet.',
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(color: surfaces.textSecondary),
                          )
                        else
                          ..._week.take(7).map((d) {
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      d.date,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: surfaces.textMuted),
                                    ),
                                  ),
                                  Expanded(
                                    child: Text(
                                      d.artistName,
                                      textAlign: TextAlign.right,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyMedium
                                          ?.copyWith(fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                DefaultTabController(
                  length: 3,
                  child: Card(
                    child: Column(
                      children: [
                        const TabBar(
                          tabs: [
                            Tab(text: 'By likes'),
                            Tab(text: 'By discoveries'),
                            Tab(text: 'Trial by Fire'),
                          ],
                        ),
                        SizedBox(
                          height: 420,
                          child: TabBarView(
                            children: [
                              _LeaderboardList(
                                songs: _likes,
                                trailingLabel: (s) => '${s.likeCount} likes',
                              ),
                              _LeaderboardList(
                                songs: _listens,
                                trailingLabel: (s) =>
                                    '${(s.playCount != 0 ? s.playCount : s.spotlightListenCount)} discoveries',
                              ),
                              _LeaderboardList(
                                songs: _trial,
                                trailingLabel: (s) =>
                                    '${(s.upvotesPerMinute ?? 0).toStringAsFixed(2)} upvotes/min',
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                if (_browseCats.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  DefaultTabController(
                    length: _browseCats.length,
                    child: Card(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
                            child: Text(
                              'Top in Browse by category',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontFamily: 'Lora'),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                            child: Text(
                              'Most-liked creator content by service type.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: surfaces.textSecondary),
                            ),
                          ),
                          TabBar(
                            isScrollable: true,
                            tabs: _browseCats
                                .map((c) => Tab(
                                      text: c.serviceType.replaceAll('_', ' '),
                                    ))
                                .toList(),
                          ),
                          SizedBox(
                            height: 260,
                            child: TabBarView(
                              children: _browseCats.map((c) {
                                return ListView.separated(
                                  padding: const EdgeInsets.all(12),
                                  itemCount: c.items.length,
                                  separatorBuilder: (_, index) =>
                                      const SizedBox(height: 8),
                                  itemBuilder: (context, i) {
                                    final item = c.items[i];
                                    return ListTile(
                                      dense: true,
                                      title: Text(item.title ?? 'Untitled'),
                                      subtitle: Text(
                                        item.providerDisplayName ?? 'Creator',
                                        style: TextStyle(
                                            color: surfaces.textSecondary),
                                      ),
                                      trailing: Text(
                                        '${item.likeCount} likes',
                                        style: TextStyle(
                                            color: surfaces.textMuted),
                                      ),
                                    );
                                  },
                                );
                              }).toList(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],

                if (_currentWeek?.votingOpen == true) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Democratic Development — Vote for Top 7',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontFamily: 'Lora'),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Pick 7 songs and rank them 1–7 (comma-separated IDs).',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: surfaces.textSecondary),
                          ),
                          const SizedBox(height: 10),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value:
                                  (_voteSongIds.length / 7).clamp(0.0, 1.0),
                              minHeight: 6,
                              backgroundColor:
                                  scheme.onSurface.withValues(alpha: 0.12),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${_voteSongIds.length}/7 selected',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: surfaces.textMuted),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _voteController,
                            decoration: const InputDecoration(
                              labelText: 'Song IDs (rank 1–7)',
                              hintText: 'song-id-1, song-id-2, ...',
                            ),
                          ),
                          if (_voteError != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              _voteError!,
                              style: TextStyle(color: scheme.error),
                            ),
                          ],
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: _voteSubmitting ||
                                      _voteSongIds.length != 7
                                  ? null
                                  : _submitVote,
                              child: _voteSubmitting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Submit vote'),
                            ),
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

class _LeaderboardList extends StatelessWidget {
  final List<LeaderboardSong> songs;
  final String Function(LeaderboardSong) trailingLabel;
  const _LeaderboardList({required this.songs, required this.trailingLabel});

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    if (songs.isEmpty) {
      return Center(
        child: Text(
          'No data yet.',
          style: TextStyle(color: surfaces.textSecondary),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: songs.length,
      separatorBuilder: (_, index) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final s = songs[i];
        return ListTile(
          leading: CircleAvatar(
            backgroundColor:
                Theme.of(context).colorScheme.primary.withValues(alpha: 0.14),
            child: Text('${i + 1}'),
          ),
          title: Text(s.title, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(
            s.artistName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: surfaces.textSecondary),
          ),
          trailing: Text(
            trailingLabel(s),
            style: TextStyle(color: surfaces.textMuted),
          ),
        );
      },
    );
  }
}
