import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/models/competition_models.dart';
import '../../core/services/competition_service.dart';
import '../../core/theme/dimension_tokens.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'top7_vote_picker.dart';

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
  List<LeaderboardSong> _positiveVotes = const [];
  List<LeaderboardSong> _bestRatios = const [];
  List<LeaderboardSong> _mostSaves = const [];
  List<LeaderboardSong> _trial = const [];
  List<NewsItem> _news = const [];
  SpotlightToday? _today;
  List<SpotlightWeekDay> _week = const [];
  CurrentWeek? _currentWeek;
  List<BrowseLeaderboardCategory> _browseCats = const [];

  List<String> _voteSongIds = <String>[];
  bool _voteSubmitting = false;
  String? _voteError;

  List<LeaderboardSong> get _voteCandidates => mergeVoteCandidates([
    _likes,
    _listens,
    _positiveVotes,
    _bestRatios,
    _mostSaves,
    _trial,
  ]);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    super.dispose();
  }

  /// Resolve [future], falling back to [fallback] if it throws. Each leaderboard
  /// section is loaded independently so one failing endpoint (e.g. a 500 on the
  /// ratio board) does not blank every tab — successful boards still render.
  Future<T> _safe<T>(Future<T> Function() future, T fallback) async {
    try {
      return await future();
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait<Object?>([
        _safe(
          () => _service.getLeaderboardSongs(by: 'likes', limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(
          () => _service.getLeaderboardSongs(by: 'listens', limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(
          () => _service.getLeaderboardSongs(by: 'positive_votes', limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(
          () => _service.getLeaderboardSongs(by: 'ratio', limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(
          () => _service.getLeaderboardSongs(by: 'saves', limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(
          () => _service.getUpvotesPerMinute(windowMinutes: 60, limit: 20),
          const <LeaderboardSong>[],
        ),
        _safe(() => _service.getNewsPromotions(limit: 10), const <NewsItem>[]),
        _safe<SpotlightToday?>(() => _service.getTodaySpotlight(), null),
        _safe(() => _service.getWeekSpotlight(), const <SpotlightWeekDay>[]),
        _safe<CurrentWeek?>(() => _service.getCurrentWeek(), null),
        _safe(
          () => _service.getBrowseLeaderboard(limitPerCategory: 5),
          const <BrowseLeaderboardCategory>[],
        ),
      ]);

      if (!mounted) return;
      setState(() {
        _likes = results[0] as List<LeaderboardSong>;
        _listens = results[1] as List<LeaderboardSong>;
        _positiveVotes = results[2] as List<LeaderboardSong>;
        _bestRatios = results[3] as List<LeaderboardSong>;
        _mostSaves = results[4] as List<LeaderboardSong>;
        _trial = results[5] as List<LeaderboardSong>;
        _news = results[6] as List<NewsItem>;
        _today = results[7] as SpotlightToday?;
        _week = results[8] as List<SpotlightWeekDay>;
        _currentWeek = results[9] as CurrentWeek?;
        _browseCats = results[10] as List<BrowseLeaderboardCategory>;
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
        _voteSongIds = <String>[];
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Vote submitted.')));
    } catch (e) {
      if (!mounted) return;
      setState(() => _voteError = 'Vote failed: $e');
    } finally {
      if (mounted) setState(() => _voteSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return DimensionScreenShell(
      title: 'Competition & Spotlight',
      showNeonLine: true,
      loading: _loading,
      actions: [
        IconButton(
          onPressed: _loading ? null : _load,
          tooltip: 'Refresh',
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Competition & Spotlight',
                  style: DimensionTypography.pageTitle(fontSize: 22),
                ),
                const SizedBox(height: 6),
                Text(
                  'Leaderboards, diamonds, and vote for Top 7',
                  style: DimensionTypography.pageSubtitle(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_news.isNotEmpty) ...[
            Text('Now Live', style: DimensionTypography.cardTitle()),
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
                    label: Text(
                      n.title,
                      overflow: TextOverflow.ellipsis,
                      style: DimensionTypography.monoCaps(
                        color: DimensionTokens.textPrimary,
                        fontSize: 11,
                      ),
                    ),
                    onPressed: n.linkUrl == null
                        ? null
                        : () => _openLink(n.linkUrl!),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],

          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      "Today's Spotlight",
                      style: DimensionTypography.cardTitle(),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: DimensionTokens.neonPink),
                        color: DimensionTokens.neonPink.withValues(alpha: 0.12),
                      ),
                      child: Text(
                        'Featured',
                        style: DimensionTypography.monoCaps(
                          color: DimensionTokens.pink400,
                          fontSize: 9,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_currentWeek != null)
                  Text(
                    'Week ${_currentWeek!.periodStart} – ${_currentWeek!.periodEnd} · Voting ${_currentWeek!.votingOpen ? 'open' : 'closed'}',
                    style: DimensionTypography.bodyMuted(),
                  ),
                const SizedBox(height: 10),
                if (_today == null)
                  Text(
                    'No spotlight set for today.',
                    style: DimensionTypography.body(),
                  )
                else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('🎤', style: TextStyle(fontSize: 28)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _today!.artistName,
                              style: DimensionTypography.cardTitle(fontSize: 16),
                            ),
                            if (_today!.songTitle != null)
                              Text(
                                _today!.songTitle!,
                                style: DimensionTypography.body(),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          GlassCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "This week's lineup",
                  style: DimensionTypography.cardTitle(),
                ),
                const SizedBox(height: 8),
                if (_week.isEmpty)
                  Text(
                    'No lineup for this week yet.',
                    style: DimensionTypography.body(),
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
                              style: DimensionTypography.bodyMuted(),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              d.artistName,
                              textAlign: TextAlign.right,
                              style: DimensionTypography.bodyPrimary(fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
          const SizedBox(height: 16),

          Theme(
            data: Theme.of(context).copyWith(
              tabBarTheme: TabBarThemeData(
                labelColor: DimensionTokens.cyan300,
                unselectedLabelColor: DimensionTokens.textMuted,
                indicatorColor: DimensionTokens.neonCyan,
                labelStyle: DimensionTypography.monoCaps(
                  color: DimensionTokens.cyan300,
                  fontSize: 11,
                ),
                unselectedLabelStyle: DimensionTypography.monoCaps(fontSize: 11),
              ),
            ),
            child: DefaultTabController(
              length: 6,
              child: GlassCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    const TabBar(
                      isScrollable: true,
                      tabs: [
                        Tab(text: 'By likes'),
                        Tab(text: 'By listens'),
                        Tab(text: 'Positive votes'),
                        Tab(text: 'Best ratio'),
                        Tab(text: 'Most saves'),
                        Tab(text: 'Votes/Minute'),
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
                                '${s.totalListenCount} listens',
                          ),
                          _LeaderboardList(
                            songs: _positiveVotes,
                            trailingLabel: (s) =>
                                '🔥 ${s.positiveVotes} · 💩 ${s.negativeVotes}',
                          ),
                          _LeaderboardList(
                            songs: _bestRatios,
                            trailingLabel: (s) =>
                                '${(s.positiveRatio * 100).toStringAsFixed(1)}% (🔥 ${s.positiveVotes} / 💩 ${s.negativeVotes})',
                          ),
                          _LeaderboardList(
                            songs: _mostSaves,
                            trailingLabel: (s) {
                              final saves = s.saveCount > 0
                                  ? s.saveCount
                                  : s.likeCount;
                              return '♥ $saves saves';
                            },
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
          ),

          if (_browseCats.isNotEmpty) ...[
            const SizedBox(height: 16),
            DefaultTabController(
              length: _browseCats.length,
              child: GlassCard(
                padding: EdgeInsets.zero,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
                      child: Text(
                        'Top in Browse by category',
                        style: DimensionTypography.cardTitle(),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                      child: Text(
                        'Most-liked creator content by service type.',
                        style: DimensionTypography.body(),
                      ),
                    ),
                    TabBar(
                      isScrollable: true,
                      labelColor: DimensionTokens.cyan300,
                      unselectedLabelColor: DimensionTokens.textMuted,
                      indicatorColor: DimensionTokens.neonCyan,
                      tabs: _browseCats
                          .map(
                            (c) => Tab(
                              text: c.serviceType.replaceAll('_', ' '),
                            ),
                          )
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
                                title: Text(
                                  item.title ?? 'Untitled',
                                  style: DimensionTypography.bodyPrimary(
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: Text(
                                  item.providerDisplayName ?? 'Creator',
                                  style: DimensionTypography.body(),
                                ),
                                trailing: Text(
                                  '${item.likeCount} likes',
                                  style: DimensionTypography.bodyMuted(),
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
            GlassCard(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Democratic Development — Vote for Top 7',
                    style: DimensionTypography.cardTitle(),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Pick 7 songs and rank them 1–7. Drag to reorder.',
                    style: DimensionTypography.body(),
                  ),
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: (_voteSongIds.length / 7).clamp(0.0, 1.0),
                      minHeight: 6,
                      color: DimensionTokens.neonCyan,
                      backgroundColor: scheme.onSurface.withValues(alpha: 0.12),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${_voteSongIds.length}/7 selected',
                    style: DimensionTypography.bodyMuted(),
                  ),
                  const SizedBox(height: 12),
                  Top7VotePicker(
                    candidates: _voteCandidates,
                    selectedIds: _voteSongIds,
                    onChanged: (ids) => setState(() => _voteSongIds = ids),
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
                      onPressed:
                          _voteSubmitting || _voteSongIds.length != 7
                          ? null
                          : _submitVote,
                      style: FilledButton.styleFrom(
                        backgroundColor: DimensionTokens.neonCyan,
                        foregroundColor: Colors.black,
                      ),
                      child: _voteSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(
                              'Submit vote',
                              style: DimensionTypography.monoCaps(
                                color: Colors.black,
                                fontSize: 12,
                              ),
                            ),
                    ),
                  ),
                ],
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
    if (songs.isEmpty) {
      return Center(
        child: Text('No data yet.', style: DimensionTypography.body()),
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
            backgroundColor: DimensionTokens.neonCyan.withValues(alpha: 0.14),
            child: Text(
              '${i + 1}',
              style: DimensionTypography.monoCaps(
                color: DimensionTokens.cyan300,
                fontSize: 11,
              ),
            ),
          ),
          title: Text(
            s.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DimensionTypography.bodyPrimary(fontSize: 14),
          ),
          subtitle: Text(
            s.artistName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: DimensionTypography.body(),
          ),
          trailing: Text(
            trailingLabel(s),
            style: DimensionTypography.bodyMuted(),
          ),
        );
      },
    );
  }
}
