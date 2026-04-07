import 'package:flutter/material.dart';
import '../../core/services/api_service.dart';
import '../../core/navigation/app_routes.dart';

class LiveSession {
  final String sessionId;
  final String artistId;
  final String displayName;
  final String? avatarUrl;
  final String? title;
  final int currentViewers;
  final int peakViewers;
  final String startedAt;
  final String status;

  LiveSession({
    required this.sessionId,
    required this.artistId,
    required this.displayName,
    this.avatarUrl,
    this.title,
    required this.currentViewers,
    required this.peakViewers,
    required this.startedAt,
    required this.status,
  });

  factory LiveSession.fromJson(Map<String, dynamic> json) {
    return LiveSession(
      sessionId: json['sessionId']?.toString() ?? '',
      artistId: json['artistId']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      title: json['title']?.toString(),
      currentViewers: (json['currentViewers'] as num?)?.toInt() ?? 0,
      peakViewers: (json['peakViewers'] as num?)?.toInt() ?? 0,
      startedAt: json['startedAt']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
    );
  }
}

enum _SortOption { recommended, viewersHigh, viewersLow, recent }

class LiveSessionsScreen extends StatefulWidget {
  const LiveSessionsScreen({super.key});

  @override
  State<LiveSessionsScreen> createState() => _LiveSessionsScreenState();
}

class _LiveSessionsScreenState extends State<LiveSessionsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<LiveSession> _sessions = [];
  _SortOption _sort = _SortOption.viewersHigh;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('artist-live/sessions');
      if (!mounted) return;
      if (res is Map<String, dynamic> && res['sessions'] is List) {
        final list = (res['sessions'] as List)
            .whereType<Map<String, dynamic>>()
            .map(LiveSession.fromJson)
            .toList();
        setState(() => _sessions = list);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _sessions = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<LiveSession> get _sorted {
    final copy = List<LiveSession>.from(_sessions);
    switch (_sort) {
      case _SortOption.viewersHigh:
        copy.sort((a, b) => b.currentViewers.compareTo(a.currentViewers));
        break;
      case _SortOption.viewersLow:
        copy.sort((a, b) => a.currentViewers.compareTo(b.currentViewers));
        break;
      case _SortOption.recent:
        copy.sort((a, b) {
          final da = DateTime.tryParse(a.startedAt) ?? DateTime(2000);
          final db = DateTime.tryParse(b.startedAt) ?? DateTime(2000);
          return db.compareTo(da);
        });
        break;
      case _SortOption.recommended:
        copy.sort((a, b) => b.currentViewers.compareTo(a.currentViewers));
        break;
    }
    return copy;
  }

  String _sortLabel(_SortOption s) {
    switch (s) {
      case _SortOption.recommended:
        return 'Recommended';
      case _SortOption.viewersHigh:
        return 'Viewers (High to Low)';
      case _SortOption.viewersLow:
        return 'Viewers (Low to High)';
      case _SortOption.recent:
        return 'Recently Started';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Text('Sort:', style: theme.textTheme.bodySmall),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButton<_SortOption>(
                    value: _sort,
                    isExpanded: true,
                    underline: const SizedBox.shrink(),
                    items: _SortOption.values
                        .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(_sortLabel(s),
                                  style: theme.textTheme.bodySmall),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) setState(() => _sort = v);
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _sessions.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'No one is live right now.',
                                style: theme.textTheme.bodyLarge?.copyWith(
                                    color:
                                        theme.colorScheme.onSurfaceVariant),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'When artists go live, they\'ll show up here and on the Listen page.',
                                textAlign: TextAlign.center,
                                style: theme.textTheme.bodySmall?.copyWith(
                                    color:
                                        theme.colorScheme.onSurfaceVariant),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _sorted.length,
                          itemBuilder: (context, i) {
                            final s = _sorted[i];
                            return _LiveSessionCard(
                              session: s,
                              onTap: () {
                                Navigator.pushNamed(
                                  context,
                                  AppRoutes.watchLive,
                                  arguments: s.artistId,
                                );
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _LiveSessionCard extends StatelessWidget {
  final LiveSession session;
  final VoidCallback onTap;

  const _LiveSessionCard({required this.session, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        child: Column(
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Container(
                color: theme.colorScheme.surfaceContainerHighest,
                child: Stack(
                  children: [
                    const Center(
                      child: Text('🔴', style: TextStyle(fontSize: 36)),
                    ),
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'LIVE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${session.currentViewers} viewers',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundImage: session.avatarUrl != null &&
                            session.avatarUrl!.isNotEmpty
                        ? NetworkImage(session.avatarUrl!)
                        : null,
                    child: session.avatarUrl == null ||
                            session.avatarUrl!.isEmpty
                        ? const Text('?')
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.displayName,
                          style: theme.textTheme.titleSmall,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          session.title ?? 'Live stream',
                          style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
