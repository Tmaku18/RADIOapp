import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/api_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/auth/auth_service.dart';

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
  final String hostRole;

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
    this.hostRole = 'artist',
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
      hostRole: json['hostRole']?.toString() ?? 'artist',
    );
  }
}

enum _SortOption { recommended, viewersHigh, viewersLow, recent }

class LiveSessionsScreen extends StatefulWidget {
  /// When true, show only DJ-hosted sets and surface a "Go live as DJ" action.
  final bool djMode;

  /// When true, show only musician performances and a "Go live as musician"
  /// action (gated behind the musician role).
  final bool performanceMode;

  const LiveSessionsScreen({
    super.key,
    this.djMode = false,
    this.performanceMode = false,
  });

  @override
  State<LiveSessionsScreen> createState() => _LiveSessionsScreenState();
}

class _LiveSessionsScreenState extends State<LiveSessionsScreen> {
  final ApiService _api = ApiService();
  bool _loading = true;
  List<LiveSession> _sessions = [];
  _SortOption _sort = _SortOption.viewersHigh;
  bool _canHost = false;

  /// The host role this tab focuses on: 'dj', 'musician', or null (all artists).
  String? get _targetRole => widget.djMode
      ? 'dj'
      : widget.performanceMode
          ? 'musician'
          : null;

  bool get _special => widget.djMode || widget.performanceMode;

  @override
  void initState() {
    super.initState();
    _load();
    if (_special) _loadRole();
  }

  Future<void> _loadRole() async {
    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final user = await authService.getUserProfile();
      if (!mounted) return;
      final role = user?.role;
      final canHost = widget.djMode
          ? (role == 'dj' || role == 'admin')
          : (role == 'musician' || role == 'admin');
      setState(() => _canHost = canHost);
    } catch (_) {
      // Leave hosting controls hidden if the profile can't be loaded.
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('artist-live/sessions');
      if (!mounted) return;
      if (res is Map<String, dynamic> && res['sessions'] is List) {
        final target = _targetRole;
        final list = (res['sessions'] as List)
            .whereType<Map<String, dynamic>>()
            .map(LiveSession.fromJson)
            // DJ sets and musician performances have dedicated tabs; the artist
            // Live directory excludes them.
            .where((s) => target != null
                ? s.hostRole == target
                : (s.hostRole != 'dj' && s.hostRole != 'musician'))
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
        title: Text(
          widget.djMode
              ? 'Live DJ'
              : widget.performanceMode
                  ? 'Live Performances'
                  : 'Live',
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: _special && _canHost
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.pushNamed(
                  context,
                  AppRoutes.goLive,
                  arguments: widget.djMode ? 'dj' : 'musician',
                );
                if (mounted) _load();
              },
              icon: Icon(widget.djMode ? Icons.podcasts : Icons.mic),
              label: Text(
                widget.djMode ? 'Go live as DJ' : 'Go live as musician',
              ),
            )
          : null,
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
                                widget.djMode
                                    ? 'No DJ is live right now.'
                                    : widget.performanceMode
                                        ? 'No live performance right now.'
                                        : 'No one is live right now.',
                                style: theme.textTheme.bodyLarge?.copyWith(
                                    color:
                                        theme.colorScheme.onSurfaceVariant),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                widget.djMode
                                    ? 'The booth is quiet. When a DJ goes live, their set will appear here.'
                                    : widget.performanceMode
                                        ? 'The stage is empty. When a musician goes live, their performance will appear here.'
                                        : 'When artists go live, they\'ll show up here and on the Listen page.',
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
                          borderRadius: BorderRadius.circular(999),
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
                          borderRadius: BorderRadius.circular(999),
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
