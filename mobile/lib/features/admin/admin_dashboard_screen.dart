import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../core/analytics/analytics_metrics.dart';
import '../../core/models/admin_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/songs_service.dart';
import '../../widgets/clip_window_sheet.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/station_assignment_field.dart';

const int _kAdminSampleMinSeconds = 5;
const int _kAdminSampleMaxSeconds = 30;
const int _kAdminDiscoverMinSeconds = 5;
const int _kAdminDiscoverMaxSeconds = 15;

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final AdminService _admin = AdminService();
  final SongsService _songsApi = SongsService();
  /// Dedicated preview player so admin listen doesn't fight the live radio bar.
  final AudioPlayer _previewPlayer = AudioPlayer();

  bool _loading = true;
  /// True while the non-Overview tabs are still filling in behind first paint.
  bool _sectionsLoading = false;
  bool _liveActionLoading = false;
  String? _error;
  Map<String, dynamic> _analytics = {};
  Map<String, dynamic> _liveStatus = {'active': false};

  List<Map<String, dynamic>> _songs = const [];
  List<AdminRadio> _radios = const [];
  /// Server queue snapshot (for lookups).
  List<AdminQueueItem> _queue = const [];
  /// Editable draft (web-style) — Apply persists via replaceRadioQueue.
  List<AdminQueueItem> _queueDraft = const [];
  List<String> _originalStackIds = const [];
  Map<String, String>? _nowPlaying;
  List<Map<String, dynamic>> _queueAddCandidates = const [];
  String? _selectedAddStackId;
  bool _showRawStackEditor = false;
  String? _selectedRadioId;
  List<Map<String, dynamic>> _users = const [];
  List<Map<String, dynamic>> _swipeCards = const [];
  List<Map<String, dynamic>> _feedMedia = const [];
  List<Map<String, dynamic>> _fallbackGroups = const [];
  List<Map<String, dynamic>> _freeRotationSongs = const [];
  List<Map<String, dynamic>> _streamerApplications = const [];

  /// Matches web admin songs default filter.
  String _songStatusFilter = 'pending';
  /// `all` or a role like `artist`.
  String _userRoleFilter = 'all';
  String? _previewingSongId;
  bool _songActionBusy = false;

  final TextEditingController _songSearchCtrl = TextEditingController();
  final TextEditingController _userSearchCtrl = TextEditingController();
  final TextEditingController _queueDraftCtrl = TextEditingController();
  final TextEditingController _fallbackTitleCtrl = TextEditingController();
  final TextEditingController _fallbackArtistCtrl = TextEditingController();
  final TextEditingController _fallbackAudioPathCtrl = TextEditingController();
  final TextEditingController _fallbackArtworkPathCtrl = TextEditingController();
  final TextEditingController _fallbackDurationCtrl = TextEditingController();
  final TextEditingController _freeRotationSearchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _previewPlayer.dispose();
    _songSearchCtrl.dispose();
    _userSearchCtrl.dispose();
    _queueDraftCtrl.dispose();
    _fallbackTitleCtrl.dispose();
    _fallbackArtistCtrl.dispose();
    _fallbackAudioPathCtrl.dispose();
    _fallbackArtworkPathCtrl.dispose();
    _fallbackDurationCtrl.dispose();
    _freeRotationSearchCtrl.dispose();
    super.dispose();
  }

  /// Runs [fn], returning null if it throws so an optional dashboard section
  /// can degrade gracefully instead of failing the whole load.
  Future<T?> _tryLoad<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } catch (e) {
      debugPrint('Admin dashboard: optional load failed: $e');
      return null;
    }
  }

  /// Loads only what the Overview tab needs, then hands off to
  /// [_loadSecondary].
  ///
  /// The dashboard used to await all thirteen of its requests one after
  /// another before painting anything, so the wait was the *sum* of every
  /// endpoint. Now the three cheap Overview calls go out together and the
  /// heavier per-tab lists stream in behind the first paint.
  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Future.wait rather than record `.wait`: it rethrows the first real
      // error, where a record wait reports only a ParallelWaitError count.
      final results = await Future.wait([
        _admin.getAnalytics(),
        _admin.getLiveStatus(),
        _admin.getRadios(),
      ]);
      final analytics = results[0] as Map<String, dynamic>;
      final liveStatus = results[1] as Map<String, dynamic>;
      final radios = results[2] as List<AdminRadio>;

      if (!mounted) return;
      setState(() {
        _analytics = analytics;
        _liveStatus = liveStatus;
        _radios = radios;
        if (radios.isNotEmpty) _selectedRadioId ??= radios.first.id;
        _loading = false;
      });
      await _loadSecondary();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  /// Fills in the six non-Overview tabs, flagging progress so those tabs can
  /// say they are still loading rather than looking empty.
  Future<void> _loadSecondary() async {
    if (mounted) setState(() => _sectionsLoading = true);
    try {
      await _fetchSections();
    } finally {
      if (mounted) setState(() => _sectionsLoading = false);
    }
  }

  /// Every request is started before any of them is awaited, so this costs
  /// roughly one round trip rather than nine. [_tryLoad] means each future
  /// resolves to null instead of throwing, so a single dead endpoint leaves
  /// its own section stale rather than blanking the dashboard.
  Future<void> _fetchSections() async {
    final radioId = _selectedRadioId;

    final songsReq = _tryLoad(
      () => _admin.getSongs(
        limit: 100,
        status: _songStatusFilter, // pending by default (web parity)
      ),
    );
    final usersReq = _tryLoad(() => _admin.getUsers(limit: 100));
    final swipeReq = _tryLoad(() => _admin.getSwipeCards(limit: 100));
    final feedReq = _tryLoad(() => _admin.getFeedMedia());
    final fallbackReq = _tryLoad(() => _admin.getFallbackSongsGrouped());
    final freeRotationReq = _tryLoad(() => _admin.getSongsInFreeRotation());
    final streamersReq = _tryLoad(() => _admin.getStreamerApplications());
    // The queue tab is scoped to the selected station; free rotation on the
    // Fallback tab deliberately stays on the default station.
    final queueReq = radioId == null
        ? null
        : _tryLoad(() => _admin.getRadioQueue(radioId, limit: 200));
    final candidatesReq = radioId == null
        ? null
        : _tryLoad(() => _admin.getSongsInFreeRotation(radioId));

    final songs = await songsReq ?? _songs;
    final users = await usersReq ?? _users;
    final swipeCards = await swipeReq ?? _swipeCards;
    final feed = await feedReq ?? _feedMedia;
    final fallback = await fallbackReq ?? _fallbackGroups;
    final freeRotation = await freeRotationReq ?? _freeRotationSongs;
    final streamers = await streamersReq ?? _streamerApplications;
    final queueRes = queueReq == null ? null : await queueReq;
    final queueCandidates =
        (candidatesReq == null ? null : await candidatesReq) ?? freeRotation;

    final queue = queueRes?.parseUpcomingQueue() ?? const <AdminQueueItem>[];

    if (!mounted) return;
    _queueDraftCtrl.text = queue.map((e) => e.stackId).join('\n');
    setState(() {
      _songs = songs;
      _users = users;
      _swipeCards = swipeCards;
      _feedMedia = feed;
      _fallbackGroups = fallback;
      _freeRotationSongs = freeRotation;
      _queueAddCandidates = queueCandidates;
      _selectedAddStackId = queueCandidates.isEmpty
          ? null
          : _candidateStackId(queueCandidates.first);
      _streamerApplications = streamers;
      _queue = queue;
      _queueDraft = List<AdminQueueItem>.from(queue);
      _originalStackIds = queue.map((e) => e.stackId).toList();
      _nowPlaying = queueRes?.parseCurrentSong();
    });
  }

  Future<void> _refreshQueue() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    final queueRes = await _admin.getRadioQueue(radioId, limit: 200);
    final queue = queueRes.parseUpcomingQueue();
    final candidates = await _admin.getSongsInFreeRotation(radioId);
    if (!mounted) return;
    setState(() {
      _queue = queue;
      _queueDraft = List<AdminQueueItem>.from(queue);
      _originalStackIds = queue.map((e) => e.stackId).toList();
      _nowPlaying = queueRes.parseCurrentSong();
      _queueDraftCtrl.text = queue.map((e) => e.stackId).join('\n');
      _queueAddCandidates = candidates;
      final selectedStillValid = candidates.any(
        (c) => _candidateStackId(c) == _selectedAddStackId,
      );
      if (!selectedStillValid) {
        _selectedAddStackId =
            candidates.isEmpty ? null : _candidateStackId(candidates.first);
      }
    });
  }

  String _candidateStackId(Map<String, dynamic> song) =>
      (song['id'] ?? song['stackId'] ?? '').toString();

  String _candidateTitle(Map<String, dynamic> song) {
    final t = (song['title'] ?? '').toString().trim();
    return t.isEmpty ? 'Untitled' : t;
  }

  String _candidateArtist(Map<String, dynamic> song) {
    final users = song['users'];
    if (users is Map) {
      final dn = (users['display_name'] ?? users['displayName'] ?? '')
          .toString()
          .trim();
      if (dn.isNotEmpty) return dn;
    }
    final a = (song['artist_name'] ?? song['artistName'] ?? '')
        .toString()
        .trim();
    return a.isEmpty ? 'Unknown artist' : a;
  }

  bool get _queueHasChanges {
    if (_queueDraft.length != _originalStackIds.length) return true;
    for (var i = 0; i < _queueDraft.length; i++) {
      if (_queueDraft[i].stackId != _originalStackIds[i]) return true;
    }
    return false;
  }

  void _syncQueueDraftCtrl() {
    _queueDraftCtrl.text = _queueDraft.map((e) => e.stackId).join('\n');
  }

  AdminQueueItem? _lookupQueueItem(String stackId) {
    for (final e in _queueDraft) {
      if (e.stackId == stackId) return e;
    }
    for (final e in _queue) {
      if (e.stackId == stackId) return e;
    }
    for (final c in _queueAddCandidates) {
      if (_candidateStackId(c) == stackId) {
        return AdminQueueItem(
          position: 0,
          stackId: stackId,
          normalizedSongId: stackId,
          source: 'songs',
          title: _candidateTitle(c),
          artistName: _candidateArtist(c),
        );
      }
    }
    return null;
  }

  void _moveQueueDraft(int index, int direction) {
    final target = index + direction;
    if (target < 0 || target >= _queueDraft.length) return;
    setState(() {
      final next = List<AdminQueueItem>.from(_queueDraft);
      final item = next.removeAt(index);
      next.insert(target, item);
      _queueDraft = next;
      _syncQueueDraftCtrl();
    });
  }

  void _removeQueueDraftAt(int index) {
    setState(() {
      final next = List<AdminQueueItem>.from(_queueDraft)..removeAt(index);
      _queueDraft = next;
      _syncQueueDraftCtrl();
    });
  }

  void _addSelectedToQueueDraft() {
    final id = _selectedAddStackId;
    if (id == null || id.isEmpty) return;
    final item = _lookupQueueItem(id) ??
        AdminQueueItem(
          position: _queueDraft.length,
          stackId: id,
          normalizedSongId: id,
          source: 'songs',
          title: id,
          artistName: 'Unknown artist',
        );
    setState(() {
      _queueDraft = [..._queueDraft, item];
      _syncQueueDraftCtrl();
    });
  }

  void _resetQueueDraft() {
    setState(() {
      _queueDraft = List<AdminQueueItem>.from(_queue);
      _syncQueueDraftCtrl();
    });
  }

  void _applyRawStackIdsToDraft() {
    final ids = _queueDraftCtrl.text
        .split('\n')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    setState(() {
      _queueDraft = [
        for (var i = 0; i < ids.length; i++)
          _lookupQueueItem(ids[i]) ??
              AdminQueueItem(
                position: i,
                stackId: ids[i],
                normalizedSongId: ids[i],
                source: 'songs',
                title: ids[i],
                artistName: 'Unknown artist',
              ),
      ];
    });
  }

  Future<void> _toggleLive() async {
    setState(() => _liveActionLoading = true);
    try {
      final active = _liveStatus['active'] == true;
      if (active) {
        await _admin.stopLive();
      } else {
        await _admin.startLive();
      }
      final status = await _admin.getLiveStatus();
      if (!mounted) return;
      setState(() => _liveStatus = status);
    } finally {
      if (mounted) setState(() => _liveActionLoading = false);
    }
  }

  Future<void> _refreshSongs() async {
    try {
      // Backend: omit status → defaults to pending; send "all" for unfiltered.
      final songs = await _admin.getSongs(
        limit: 100,
        status: _songStatusFilter,
        search: _songSearchCtrl.text.trim().isEmpty
            ? null
            : _songSearchCtrl.text.trim(),
        sortBy: 'created_at',
        sortOrder: 'desc',
      );
      if (!mounted) return;
      setState(() => _songs = songs);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load songs: $e')),
      );
    }
  }

  Future<void> _refreshUsers() async {
    try {
      final users = await _admin.getUsers(
        limit: 100,
        role: _userRoleFilter == 'all' ? null : _userRoleFilter,
        search: _userSearchCtrl.text.trim().isEmpty
            ? null
            : _userSearchCtrl.text.trim(),
        sortBy: 'created_at',
        sortOrder: 'desc',
      );
      if (!mounted) return;
      setState(() => _users = users);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load users: $e')),
      );
    }
  }

  String _songField(Map<String, dynamic> song, String snake, [String? camel]) {
    final a = song[snake];
    if (a != null && '$a'.isNotEmpty) return '$a';
    if (camel != null) {
      final b = song[camel];
      if (b != null && '$b'.isNotEmpty) return '$b';
    }
    return '';
  }

  Future<void> _togglePreview(Map<String, dynamic> song) async {
    final id = _songField(song, 'id');
    final url = _songField(song, 'audio_url', 'audioUrl');
    if (id.isEmpty || url.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No audio URL for this song.')),
      );
      return;
    }
    try {
      if (_previewingSongId == id && _previewPlayer.playing) {
        await _previewPlayer.pause();
        if (mounted) setState(() {});
        return;
      }
      if (_previewingSongId == id && !_previewPlayer.playing) {
        await _previewPlayer.play();
        if (mounted) setState(() {});
        return;
      }
      await _previewPlayer.setUrl(url);
      await _previewPlayer.play();
      if (mounted) setState(() => _previewingSongId = id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not play song: $e')),
      );
    }
  }

  Future<void> _runSongAction(Future<void> Function() action, String ok) async {
    if (_songActionBusy) return;
    setState(() => _songActionBusy = true);
    try {
      await action();
      await _refreshSongs();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    } finally {
      if (mounted) setState(() => _songActionBusy = false);
    }
  }

  Future<void> _rejectSong(String id, String title) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Reject: $title'),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Why is this rejected? (required)',
            helperText:
                'At least 10 characters. The artist and other admins will see this.',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (reasonCtrl.text.trim().length < 10) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Add a detailed reason (at least 10 characters).',
                    ),
                  ),
                );
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirmed != true) return;
    if (reason.length < 10) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A detailed rejection reason is required.'),
        ),
      );
      return;
    }
    await _runSongAction(
      () => _admin.updateSongStatus(
        id,
        'rejected',
        reason: reason,
      ),
      'Song rejected.',
    );
  }

  Future<void> _editSongMetadata(Map<String, dynamic> song) async {
    final id = _songField(song, 'id');
    final titleCtrl = TextEditingController(
      text: _songField(song, 'title'),
    );
    final artworkCtrl = TextEditingController(
      text: _songField(song, 'artwork_url', 'artworkUrl'),
    );
    var isExplicit = song['is_explicit'] == true || song['isExplicit'] == true;
    var stationIds = List<String>.from(stationIdsFromSongMap(song));
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: const Text('Edit Song Metadata'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Title',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Stations / Genres',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  StationAssignmentField(
                    value: stationIds,
                    onChanged: (next) => setLocal(() => stationIds = next),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: artworkCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Album Cover URL',
                      hintText: 'https://...',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Theme.of(context)
                            .colorScheme
                            .outline
                            .withValues(alpha: 0.35),
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: SwitchListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                      title: const Text('Explicit content'),
                      subtitle: const Text(
                        'Mark this song explicit when audio includes '
                        'explicit language/content.',
                      ),
                      value: isExplicit,
                      onChanged: (v) => setLocal(() => isExplicit = v),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (titleCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Title cannot be empty')),
                  );
                  return;
                }
                if (stationIds.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Please select at least one station'),
                    ),
                  );
                  return;
                }
                Navigator.pop(context, true);
              },
              child: const Text('Save Metadata'),
            ),
          ],
        ),
      ),
    );
    final title = titleCtrl.text.trim();
    final artwork = artworkCtrl.text.trim();
    final stations = List<String>.from(stationIds);
    titleCtrl.dispose();
    artworkCtrl.dispose();
    if (saved != true || id.isEmpty) return;
    if (title.isEmpty || stations.isEmpty) return;
    await _runSongAction(
      () => _admin.updateSongMetadata(id, {
        'title': title,
        'stationId': stations.first,
        'stationIds': stations,
        'artworkUrl': artwork,
        'isExplicit': isExplicit,
      }),
      'Song updated.',
    );
  }

  Future<void> _openUserDetail(Map<String, dynamic> user) async {
    final userId = '${user['id'] ?? ''}';
    if (userId.isEmpty) return;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );
    try {
      final profile = await _admin.getUserProfile(userId);
      if (!mounted) return;
      Navigator.pop(context); // loading
      final u = (profile['user'] as Map?)?.cast<String, dynamic>() ?? user;
      final songs = ((profile['songs'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => e.map((k, v) => MapEntry(k.toString(), v)))
          .toList();
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0A0A0C),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) {
          return DraggableScrollableSheet(
            expand: false,
            initialChildSize: 0.75,
            minChildSize: 0.45,
            maxChildSize: 0.95,
            builder: (context, scrollController) {
              return ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    '${u['display_name'] ?? 'User'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${u['email'] ?? ''} · ${u['role'] ?? ''}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.7)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Plays: ${profile['totalPlays'] ?? 0} · Likes: ${profile['totalLikes'] ?? 0} · Listens: ${profile['totalListenCount'] ?? 0}',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Songs',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (songs.isEmpty)
                    Text(
                      'No songs for this user.',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                    )
                  else
                    ...songs.map((s) {
                      final sid = '${s['id']}';
                      final st = '${s['status'] ?? ''}'.toLowerCase();
                      return Card(
                        child: ListTile(
                          title: Text('${s['title'] ?? 'Untitled'}'),
                          subtitle: Text(
                            '${s['artist_name'] ?? ''} · $st · plays ${s['play_count'] ?? 0}',
                          ),
                          trailing: Wrap(
                            spacing: 4,
                            children: [
                              if (st != 'approved')
                                IconButton(
                                  tooltip: 'Approve',
                                  icon: const Icon(Icons.check_circle_outline),
                                  onPressed: () async {
                                    await _admin.updateSongStatus(
                                      sid,
                                      'approved',
                                    );
                                    if (!context.mounted) return;
                                    Navigator.pop(context);
                                    await _refreshSongs();
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(this.context)
                                        .showSnackBar(
                                      const SnackBar(
                                        content: Text('Song approved.'),
                                      ),
                                    );
                                  },
                                ),
                              if (st != 'rejected')
                                IconButton(
                                  tooltip: 'Reject',
                                  icon: const Icon(Icons.cancel_outlined),
                                  onPressed: () async {
                                    Navigator.pop(context);
                                    await _rejectSong(
                                      sid,
                                      '${s['title'] ?? 'Song'}',
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              );
            },
          );
        },
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // loading
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load user: $e')),
      );
    }
  }

  Future<void> _saveQueueDraft() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    if (_showRawStackEditor) _applyRawStackIdsToDraft();
    final stackIds = _queueDraft.map((e) => e.stackId).toList();
    try {
      await _admin.replaceRadioQueue(radioId, stackIds);
      await _refreshQueue();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Queue updated for upcoming tracks.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save queue: $e')),
      );
    }
  }

  Future<void> _skipCurrentTrack() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    try {
      await _admin.skipRadioQueueTrack(radioId);
      await _refreshQueue();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Skipped current track for this station.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to skip: $e')),
      );
    }
  }

  Future<void> _submitFallbackFromUpload() async {
    final title = _fallbackTitleCtrl.text.trim();
    final artistName = _fallbackArtistCtrl.text.trim();
    final audioPath = _fallbackAudioPathCtrl.text.trim();
    if (title.isEmpty || artistName.isEmpty || audioPath.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title, artist, and audio path are required.')),
      );
      return;
    }
    await _admin.addFallbackSongFromUpload(
      title: title,
      artistName: artistName,
      audioPath: audioPath,
      artworkPath: _fallbackArtworkPathCtrl.text.trim().isEmpty
          ? null
          : _fallbackArtworkPathCtrl.text.trim(),
      durationSeconds: int.tryParse(_fallbackDurationCtrl.text.trim()),
    );
    final fallback = await _admin.getFallbackSongsGrouped();
    if (!mounted) return;
    setState(() => _fallbackGroups = fallback);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Fallback song added from upload payload.')),
    );
  }

  Future<void> _searchAndToggleFreeRotation() async {
    final query = _freeRotationSearchCtrl.text.trim();
    if (query.isEmpty) return;
    final songs = await _admin.searchSongsForFreeRotation(query);
    if (!mounted) return;
    if (songs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No songs found for that search.')),
      );
      return;
    }
    final first = songs.first;
    final songId = '${first['id']}';
    final enabled = first['admin_free_rotation'] == true;
    await _admin.toggleFreeRotation(songId, !enabled);
    final freeRotation = await _admin.getSongsInFreeRotation();
    if (!mounted) return;
    setState(() => _freeRotationSongs = freeRotation);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${first['title'] ?? 'Song'} is now ${enabled ? 'disabled' : 'enabled'} in free rotation.',
        ),
      ),
    );
  }

  Widget _metricTile(String label, Object? value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  Text('${value ?? 0}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const DimensionScreenShell(
        title: 'Admin Dashboard',
        showNeonLine: true,
        loading: true,
        body: SizedBox.shrink(),
      );
    }
    if (_error != null) {
      return DimensionScreenShell(
        title: 'Admin Dashboard',
        showNeonLine: true,
        body: Center(child: Text(_error!)),
      );
    }

    return DefaultTabController(
      length: 7,
      child: DimensionScreenShell(
        title: 'Admin Dashboard',
        showNeonLine: true,
        actions: [
          IconButton(
            tooltip: 'DJ Booth',
            onPressed: () =>
                Navigator.pushNamed(context, AppRoutes.adminDjBooth),
            icon: const Icon(Icons.headphones),
          ),
          IconButton(onPressed: _loadInitial, icon: const Icon(Icons.refresh)),
        ],
        body: Column(
          children: [
            const TabBar(
              isScrollable: true,
              tabs: [
                Tab(text: 'Overview'),
                Tab(text: 'Songs'),
                Tab(text: 'Queue'),
                Tab(text: 'Users'),
                Tab(text: 'Swipe/Feed'),
                Tab(text: 'Fallback/Rotation'),
                Tab(text: 'Streamers'),
              ],
            ),
            // Overview paints before the other tabs have their data, so say so
            // rather than letting those lists read as empty.
            SizedBox(
              height: 2,
              child: _sectionsLoading
                  ? const LinearProgressIndicator(minHeight: 2)
                  : null,
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildOverviewTab(),
                  _buildSongsTab(),
                  _buildQueueTab(),
                  _buildUsersTab(),
                  _buildSwipeFeedTab(),
                  _buildFallbackRotationTab(),
                  _buildStreamersTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    final active = _liveStatus['active'] == true;
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(width: 220, child: _metricTile('Total Users', _analytics['totalUsers'], Icons.people_alt_outlined)),
            SizedBox(width: 220, child: _metricTile('Total Artists', _analytics['totalArtists'], Icons.mic_outlined)),
            SizedBox(width: 220, child: _metricTile('Total Songs', _analytics['totalSongs'], Icons.music_note_outlined)),
            SizedBox(width: 220, child: _metricTile(AnalyticsMetrics.earsReached.label, _analytics['earsReached'] ?? 0, Icons.favorite_border)),
            SizedBox(width: 220, child: _metricTile(AnalyticsMetrics.listens.label, _analytics['totalListenCount'] ?? _analytics['listens'] ?? 0, Icons.hearing_outlined)),
            SizedBox(width: 220, child: _metricTile('Pending Songs', _analytics['pendingSongs'], Icons.hourglass_top_outlined)),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: Icon(active ? Icons.sensors : Icons.sensors_off),
            title: Text(active ? 'Live broadcast is active' : 'Live broadcast is offline'),
            subtitle: Text(active ? 'Tap to stop current live broadcast.' : 'Tap to start a platform live broadcast.'),
            trailing: FilledButton(
              onPressed: _liveActionLoading ? null : _toggleLive,
              child: Text(_liveActionLoading ? 'Working...' : (active ? 'Stop' : 'Go live')),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.mail_outline),
            title: const Text('Email TestFlight beta invite'),
            subtitle: const Text(
              'Send every user the iPhone beta link — join, upload songs, send feedback.',
            ),
            trailing: FilledButton.tonal(
              onPressed: _sendTestFlightBetaInvite,
              child: const Text('Email all'),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.system_update_alt_outlined),
            title: const Text('Notify users of an app update'),
            subtitle: const Text(
              'Publish a release and push “update available” to all devices.',
            ),
            trailing: FilledButton.tonal(
              onPressed: _publishAppUpdate,
              child: const Text('Broadcast'),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _sendTestFlightBetaInvite() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Email every user?'),
        content: const Text(
          'This sends the TestFlight beta link to every account email on the platform. Ask them to join, upload songs, and send feedback.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Send emails'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      final result = await _admin.sendTestFlightBetaInvite();
      if (!mounted) return;
      final already = result['alreadyRunning'] == true;
      final queued = result['queued'];
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            already
                ? 'A TestFlight invite send is already running.'
                : 'Queued TestFlight invites for $queued user${queued == 1 ? '' : 's'}.',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Couldn’t send TestFlight emails: $e')),
      );
    }
  }

  Future<void> _publishAppUpdate() async {
    final versionCtrl = TextEditingController(text: '1.0.16');
    final titleCtrl = TextEditingController(text: 'Update available');
    final bodyCtrl = TextEditingController(
      text: 'A new version of NETWORX Radio is ready. Tap to update.',
    );
    var broadcastPush = true;
    var platform = 'all';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            return AlertDialog(
              title: const Text('Broadcast app update'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: versionCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Latest version (e.g. 1.0.16)',
                      ),
                    ),
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(labelText: 'Title'),
                    ),
                    TextField(
                      controller: bodyCtrl,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Message'),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: platform,
                      decoration: const InputDecoration(labelText: 'Platform'),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All')),
                        DropdownMenuItem(value: 'ios', child: Text('iOS')),
                        DropdownMenuItem(
                          value: 'android',
                          child: Text('Android'),
                        ),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setLocal(() => platform = v);
                      },
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Send push now'),
                      value: broadcastPush,
                      onChanged: (v) => setLocal(() => broadcastPush = v),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Publish'),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed != true || !mounted) {
      versionCtrl.dispose();
      titleCtrl.dispose();
      bodyCtrl.dispose();
      return;
    }

    try {
      await _admin.publishAppRelease(
        latestVersion: versionCtrl.text.trim(),
        title: titleCtrl.text.trim(),
        body: bodyCtrl.text.trim(),
        platform: platform,
        broadcastPush: broadcastPush,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            broadcastPush
                ? 'Release published and push broadcast started.'
                : 'Release published (no push).',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to publish release: $e')),
      );
    } finally {
      versionCtrl.dispose();
      titleCtrl.dispose();
      bodyCtrl.dispose();
    }
  }

  Widget _buildSongsTab() {
    final filters = const ['pending', 'approved', 'rejected', 'all'];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _songSearchCtrl,
                onSubmitted: (_) => _refreshSongs(),
                decoration: const InputDecoration(
                  labelText: 'Search songs by title',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshSongs, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: filters
              .map(
                (f) => ChoiceChip(
                  label: Text(f[0].toUpperCase() + f.substring(1)),
                  selected: _songStatusFilter == f,
                  onSelected: (_) async {
                    setState(() => _songStatusFilter = f);
                    await _refreshSongs();
                  },
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        Text(
          _songs.isEmpty
              ? 'No songs for this filter.'
              : '${_songs.length} song(s)',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        ..._songs.map((song) {
          final id = _songField(song, 'id');
          final title = _songField(song, 'title').isEmpty
              ? 'Untitled'
              : _songField(song, 'title');
          final artist = _songField(song, 'artist_name', 'artistName').isEmpty
              ? 'Unknown artist'
              : _songField(song, 'artist_name', 'artistName');
          final status = _songField(song, 'status').isEmpty
              ? 'unknown'
              : _songField(song, 'status').toLowerCase();
          final duration = song['duration_seconds'] ?? song['durationSeconds'];
          final audioUrl = _songField(song, 'audio_url', 'audioUrl');
          final isPreviewing =
              _previewingSongId == id && _previewPlayer.playing;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '$artist · $status${duration != null ? ' · ${duration}s' : ''}',
                    style: const TextStyle(color: Colors.grey),
                  ),
                  Builder(
                    builder: (_) {
                      final stations = stationIdsFromSongMap(song);
                      final labels = stationLabelsForIds(stations);
                      if (labels.isEmpty) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Stations: $labels',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontSize: 12,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _togglePreview(song),
                        icon: Icon(
                          isPreviewing ? Icons.pause : Icons.play_arrow,
                        ),
                        label: Text(isPreviewing ? 'Pause' : 'Play'),
                      ),
                      // Hide once decided — Approve gone when approved, Reject when rejected.
                      if (status != 'approved')
                        OutlinedButton(
                          onPressed: _songActionBusy
                              ? null
                              : () => _runSongAction(
                                    () => _admin.updateSongStatus(
                                      id,
                                      'approved',
                                    ),
                                    'Song approved.',
                                  ),
                          child: const Text('Approve'),
                        ),
                      if (status != 'rejected')
                        OutlinedButton(
                          onPressed: _songActionBusy
                              ? null
                              : () => _rejectSong(id, title),
                          child: const Text('Reject'),
                        ),
                      OutlinedButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _editSongMetadata(song),
                        child: const Text('Edit'),
                      ),
                      OutlinedButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _runSongAction(
                                  () => _admin.toggleFreeRotation(
                                    id,
                                    song['admin_free_rotation'] != true,
                                  ),
                                  'Free rotation updated.',
                                ),
                        child: const Text('Free Rotation'),
                      ),
                      OutlinedButton(
                        onPressed: () => _showTrimDialog(
                          id,
                          title,
                          audioUrl: audioUrl,
                          durationSeconds: (duration is num)
                              ? duration.toInt()
                              : int.tryParse('$duration'),
                        ),
                        child: const Text('Trim'),
                      ),
                      OutlinedButton(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _openAdminSampleTrim(song),
                        child: const Text('Sample'),
                      ),
                      OutlinedButton(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _openAdminDiscoverClip(song),
                        child: const Text('Discover clip'),
                      ),
                      TextButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _runSongAction(
                                  () => _admin.deleteSong(id),
                                  'Song deleted.',
                                ),
                        child: const Text('Delete'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildQueueTab() {
    final nowTitle = _nowPlaying?['title'];
    final nowArtist = _nowPlaying?['artistName'];
    final candidateItems = _queueAddCandidates
        .map(_candidateStackId)
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Text(
          'Queue Manager',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Manage upcoming queue and skip the current track when needed.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.tonal(
            onPressed: _skipCurrentTrack,
            child: const Text('Skip Current Track'),
          ),
        ),
        const SizedBox(height: 12),
        if (_radios.isNotEmpty)
          DropdownButtonFormField<String>(
            value: _radios.any((r) => r.id == _selectedRadioId)
                ? _selectedRadioId
                : _radios.first.id,
            decoration: const InputDecoration(
              labelText: 'Station',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: _radios
                .map(
                  (r) => DropdownMenuItem(
                    value: r.id,
                    child: Text(
                      r.label.isNotEmpty ? r.label : r.id,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (id) async {
              if (id == null || id == _selectedRadioId) return;
              setState(() => _selectedRadioId = id);
              await _refreshQueue();
            },
          ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Now Playing',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  nowTitle == null
                      ? 'No active track'
                      : '$nowTitle — ${nowArtist ?? 'Unknown artist'}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Add Eligible Song',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.65),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey<String?>(_selectedAddStackId),
                  initialValue: candidateItems.contains(_selectedAddStackId)
                      ? _selectedAddStackId
                      : null,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: _queueAddCandidates
                      .where((c) => _candidateStackId(c).isNotEmpty)
                      .map((c) {
                    final id = _candidateStackId(c);
                    return DropdownMenuItem<String>(
                      value: id,
                      child: Text(
                        '${_candidateTitle(c)} — ${_candidateArtist(c)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedAddStackId = v),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _selectedAddStackId == null
                      ? null
                      : _addSelectedToQueueDraft,
                  child: const Text('Add to Draft Queue'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Upcoming Queue (Draft)',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    TextButton(
                      onPressed:
                          _queueHasChanges ? _resetQueueDraft : null,
                      child: const Text('Reset'),
                    ),
                    const SizedBox(width: 4),
                    FilledButton(
                      onPressed:
                          _queueHasChanges ? _saveQueueDraft : null,
                      child: const Text('Apply Queue Changes'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_queueDraft.isEmpty)
                  Text(
                    'No upcoming entries.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.65),
                    ),
                  )
                else
                  ...List.generate(_queueDraft.length, (idx) {
                    final entry = _queueDraft[idx];
                    final title = entry.title.trim().isEmpty
                        ? entry.stackId
                        : entry.title;
                    final artist = entry.artistName.trim().isEmpty
                        ? 'Unknown artist'
                        : entry.artistName;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 36,
                              child: Text(
                                '#${idx + 1}',
                                style: TextStyle(
                                  color:
                                      Colors.white.withValues(alpha: 0.55),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    artist,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.white
                                          .withValues(alpha: 0.55),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Up',
                              onPressed: idx == 0
                                  ? null
                                  : () => _moveQueueDraft(idx, -1),
                              icon: const Icon(Icons.arrow_upward, size: 18),
                            ),
                            IconButton(
                              tooltip: 'Down',
                              onPressed: idx >= _queueDraft.length - 1
                                  ? null
                                  : () => _moveQueueDraft(idx, 1),
                              icon:
                                  const Icon(Icons.arrow_downward, size: 18),
                            ),
                            IconButton(
                              tooltip: 'Remove',
                              onPressed: () => _removeQueueDraftAt(idx),
                              icon: const Icon(
                                Icons.delete_outline,
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _showRawStackEditor = !_showRawStackEditor;
                      if (_showRawStackEditor) _syncQueueDraftCtrl();
                    });
                  },
                  child: Text(
                    _showRawStackEditor
                        ? 'Hide stack ID editor'
                        : 'Advanced: edit stack IDs',
                  ),
                ),
                if (_showRawStackEditor) ...[
                  TextField(
                    controller: _queueDraftCtrl,
                    minLines: 4,
                    maxLines: 10,
                    decoration: const InputDecoration(
                      labelText: 'Queue stack IDs (one per line)',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) {},
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () {
                      _applyRawStackIdsToDraft();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Draft updated from stack IDs.'),
                        ),
                      );
                    },
                    child: const Text('Apply IDs to draft'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _userLabel(Map<String, dynamic> user) {
    final name = '${user['display_name'] ?? ''}'.trim();
    if (name.isNotEmpty) return name;
    final email = '${user['email'] ?? ''}'.trim();
    return email.isNotEmpty ? email : 'this user';
  }

  Future<void> _confirmLifetimeBan(Map<String, dynamic> user) async {
    final userId = '${user['id'] ?? ''}';
    if (userId.isEmpty) return;
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Lifetime ban / deactivate?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'This permanently deactivates ${_userLabel(user)}\'s account and '
              'deletes all of their songs from the database and storage. The '
              'user record is kept so they cannot create a new account.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason (optional)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Deactivate & ban'),
          ),
        ],
      ),
    );
    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirmed != true) return;
    try {
      await _admin.lifetimeBanUser(
        userId,
        reason.isEmpty ? 'Lifetime ban by admin' : reason,
      );
      await _refreshUsers();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Account deactivated and banned.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Ban failed: $e')));
    }
  }

  Future<void> _confirmDeleteUserAccount(Map<String, dynamic> user) async {
    final userId = '${user['id'] ?? ''}';
    if (userId.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this account?'),
        content: Text(
          'This permanently deletes ${_userLabel(user)}\'s account and all '
          'associated data, including their songs. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete account'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _admin.deleteUserAccount(userId);
      await _refreshUsers();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Account deleted.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
    }
  }

  Future<void> _confirmShadowBan(Map<String, dynamic> user) async {
    final userId = '${user['id'] ?? ''}';
    if (userId.isEmpty) return;
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Shadow ban this user?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${_userLabel(user)} can still use the app, but their chat '
              'messages will be invisible to everyone else. Use this for chat '
              'trolls without tipping them off.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason (required)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (reasonCtrl.text.trim().length < 3) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Add a short reason (at least 3 characters).',
                    ),
                  ),
                );
                return;
              }
              Navigator.pop(context, true);
            },
            child: const Text('Shadow ban'),
          ),
        ],
      ),
    );
    final reason = reasonCtrl.text.trim();
    reasonCtrl.dispose();
    if (confirmed != true) return;
    if (reason.length < 3) return;
    try {
      await _admin.shadowBanUser(userId, reason);
      await _refreshUsers();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User shadow banned.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Shadow ban failed: $e')));
    }
  }

  Future<void> _confirmRestoreUser(Map<String, dynamic> user) async {
    final userId = '${user['id'] ?? ''}';
    if (userId.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Restore this user?'),
        content: Text(
          'This clears the shadow ban (and any hard ban flags) for '
          '${_userLabel(user)}. Their chat messages will be visible again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Restore access'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _admin.restoreUser(userId);
      await _refreshUsers();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User restored.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Restore failed: $e')));
    }
  }

  Widget _buildUsersTab() {
    final roles = const ['all', 'artist', 'listener', 'admin', 'dj', 'musician'];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _userSearchCtrl,
                onSubmitted: (_) => _refreshUsers(),
                decoration: const InputDecoration(
                  labelText: 'Search users / artists (name or email)',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshUsers, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: roles
              .map(
                (r) => ChoiceChip(
                  label: Text(r[0].toUpperCase() + r.substring(1)),
                  selected: _userRoleFilter == r,
                  onSelected: (_) async {
                    setState(() => _userRoleFilter = r);
                    await _refreshUsers();
                  },
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        Text(
          _users.isEmpty
              ? 'No users for this filter.'
              : '${_users.length} user(s)',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        ..._users.map((user) {
          final userId = '${user['id']}';
          final role = '${user['role'] ?? 'listener'}';
          final isShadowBanned = user['is_shadow_banned'] == true;
          final isBanned = user['is_banned'] == true;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${user['display_name'] ?? 'Unnamed'}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text('${user['email'] ?? ''} · $role'),
                  if (isShadowBanned || isBanned) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (isShadowBanned)
                          Chip(
                            label: const Text('Shadow banned'),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: Colors.amber.withValues(
                              alpha: 0.25,
                            ),
                          ),
                        if (isBanned)
                          Chip(
                            label: const Text('Banned'),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: Colors.red.withValues(alpha: 0.25),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonal(
                        onPressed: () => _openUserDetail(user),
                        child: const Text('Open / Songs'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          try {
                            await _admin.updateUserRole(
                              userId,
                              role == 'artist' ? 'listener' : 'artist',
                            );
                            await _refreshUsers();
                          } catch (e) {
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Role update failed: $e')),
                            );
                          }
                        },
                        child: Text(
                          role == 'artist' ? 'Make Listener' : 'Make Artist',
                        ),
                      ),
                      if (!isShadowBanned)
                        OutlinedButton(
                          onPressed: () => _confirmShadowBan(user),
                          child: const Text('Shadow Ban'),
                        ),
                      if (isShadowBanned || isBanned)
                        OutlinedButton(
                          onPressed: () => _confirmRestoreUser(user),
                          child: const Text('Restore'),
                        ),
                      OutlinedButton(
                        onPressed: () => _confirmLifetimeBan(user),
                        child: const Text('Lifetime Ban'),
                      ),
                      TextButton(
                        onPressed: () => _confirmDeleteUserAccount(user),
                        child: const Text('Delete Account'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildSwipeFeedTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('Swipe cards', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._swipeCards.map(
          (card) => Card(
            child: ListTile(
              title: Text('${card['title'] ?? 'Untitled'}'),
              subtitle: Text('${card['artistName'] ?? ''}'),
              trailing: TextButton(
                onPressed: () async {
                  await _admin.deleteSwipeClip('${card['songId']}');
                  final cards = await _admin.getSwipeCards(limit: 100);
                  if (!mounted) return;
                  setState(() => _swipeCards = cards);
                },
                child: const Text('Delete Clip'),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text('Feed media moderation', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._feedMedia.map(
          (item) {
            final provider = item['provider'];
            final providerName = provider is Map
                ? '${provider['displayName'] ?? provider['display_name'] ?? 'Unknown'}'
                : '${item['authorDisplayName'] ?? 'Unknown'}';
            final caption =
                '${item['description'] ?? item['title'] ?? item['caption'] ?? ''}';
            return Card(
            child: ListTile(
              title: Text(providerName),
              subtitle: Text(caption),
              trailing: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () async {
                      await _admin.removeFromFeed('${item['id']}');
                      final feed = await _admin.getFeedMedia();
                      if (!mounted) return;
                      setState(() => _feedMedia = feed);
                    },
                    child: const Text('Remove'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.deleteFeedMedia('${item['id']}');
                      final feed = await _admin.getFeedMedia();
                      if (!mounted) return;
                      setState(() => _feedMedia = feed);
                    },
                    child: const Text('Delete'),
                  ),
                ],
              ),
            ),
          );
          },
        ),
      ],
    );
  }

  Widget _buildFallbackRotationTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('Fallback upload (from storage paths)', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(controller: _fallbackTitleCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackArtistCtrl, decoration: const InputDecoration(labelText: 'Artist name', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackAudioPathCtrl, decoration: const InputDecoration(labelText: 'Audio path', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackArtworkPathCtrl, decoration: const InputDecoration(labelText: 'Artwork path (optional)', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackDurationCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Duration seconds (optional)', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        FilledButton(onPressed: _submitFallbackFromUpload, child: const Text('Add Fallback Song')),
        const SizedBox(height: 16),
        const Text('Grouped fallback songs', style: TextStyle(fontWeight: FontWeight.bold)),
        ..._fallbackGroups.map(
          (song) => Card(
            child: ListTile(
              title: Text('${song['title'] ?? ''}'),
              subtitle: Text('${song['artist_name'] ?? ''}'),
              trailing: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () async {
                      await _admin.updateFallbackSongGroup(
                        '${song['id']}',
                        {'isActive': song['is_active'] != true},
                      );
                      final fallback = await _admin.getFallbackSongsGrouped();
                      if (!mounted) return;
                      setState(() => _fallbackGroups = fallback);
                    },
                    child: const Text('Toggle'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.deleteFallbackSongGroup('${song['id']}');
                      final fallback = await _admin.getFallbackSongsGrouped();
                      if (!mounted) return;
                      setState(() => _fallbackGroups = fallback);
                    },
                    child: const Text('Delete'),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Free rotation', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _freeRotationSearchCtrl,
                decoration: const InputDecoration(
                  labelText: 'Song search (toggle first result)',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _searchAndToggleFreeRotation,
              child: const Text('Toggle'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ..._freeRotationSongs.map(
          (song) => ListTile(
            leading: const Icon(Icons.playlist_add_check_circle_outlined),
            title: Text('${song['title'] ?? ''}'),
            subtitle: Text('${song['artist_name'] ?? ''}'),
          ),
        ),
      ],
    );
  }

  Widget _buildStreamersTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        ..._streamerApplications.map(
          (application) => Card(
            child: ListTile(
              title: Text('${application['displayName'] ?? 'Unknown user'}'),
              subtitle: Text('${application['email'] ?? ''}'),
              trailing: Wrap(
                spacing: 4,
                children: [
                  FilledButton.tonal(
                    onPressed: () async {
                      await _admin.setStreamerApproval('${application['userId']}', 'approve');
                      final streamers = await _admin.getStreamerApplications();
                      if (!mounted) return;
                      setState(() => _streamerApplications = streamers);
                    },
                    child: const Text('Approve'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.setStreamerApproval('${application['userId']}', 'reject');
                      final streamers = await _admin.getStreamerApplications();
                      if (!mounted) return;
                      setState(() => _streamerApplications = streamers);
                    },
                    child: const Text('Reject'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _openAdminSampleTrim(Map<String, dynamic> song) async {
    final id = _songField(song, 'id');
    final title = _songField(song, 'title').isEmpty
        ? 'Untitled'
        : _songField(song, 'title');
    final audioUrl = _songField(song, 'audio_url', 'audioUrl');
    if (id.isEmpty || audioUrl.isEmpty) return;

    final durationRaw = song['duration_seconds'] ?? song['durationSeconds'];
    final durationSeconds = (durationRaw is num)
        ? durationRaw.toInt()
        : int.tryParse('$durationRaw');

    final startRaw =
        song['sample_start_seconds'] ?? song['sampleStartSeconds'] ?? 0;
    final endRaw = song['sample_end_seconds'] ?? song['sampleEndSeconds'];
    final start = (startRaw is num)
        ? startRaw.toDouble()
        : double.tryParse('$startRaw') ?? 0;
    final parsedEnd = (endRaw is num)
        ? endRaw.toDouble()
        : double.tryParse('$endRaw');
    final end = (parsedEnd != null && parsedEnd > start)
        ? parsedEnd
        : start + _kAdminSampleMaxSeconds;
    final sampleUrl = _songField(song, 'sample_url', 'sampleUrl');
    final alreadySet = sampleUrl.isNotEmpty || start > 0;

    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ClipWindowSheet(
        audioUrl: audioUrl,
        displayTitle: title,
        durationSeconds: durationSeconds,
        heading: 'Set preview sample',
        saveLabel: 'Save sample',
        savedMessage: 'Sample saved. Rendering preview…',
        minLength: _kAdminSampleMinSeconds,
        maxLength: _kAdminSampleMaxSeconds,
        initialStart: start,
        initialEnd: end,
        alreadySet: alreadySet,
        overwriteWarning:
            'A sample is already set (${clipFmtTime(start)} – ${clipFmtTime(end)}). Saving overwrites it.',
        onSave: (s, e) => _songsApi.setSample(id, s, endSeconds: e),
      ),
    );
    if (updated == true && mounted) {
      await _refreshSongs();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sample clip saved.')),
      );
    }
  }

  Future<void> _openAdminDiscoverClip(Map<String, dynamic> song) async {
    final id = _songField(song, 'id');
    final title = _songField(song, 'title').isEmpty
        ? 'Untitled'
        : _songField(song, 'title');
    final audioUrl = _songField(song, 'audio_url', 'audioUrl');
    if (id.isEmpty || audioUrl.isEmpty) return;

    final durationRaw = song['duration_seconds'] ?? song['durationSeconds'];
    final durationSeconds = (durationRaw is num)
        ? durationRaw.toInt()
        : int.tryParse('$durationRaw');

    final startRaw = song['discover_clip_start_seconds'] ??
        song['discoverClipStartSeconds'] ??
        0;
    final endRaw = song['discover_clip_end_seconds'] ??
        song['discoverClipEndSeconds'];
    final start = (startRaw is num)
        ? startRaw.toDouble()
        : double.tryParse('$startRaw') ?? 0;
    final parsedEnd = (endRaw is num)
        ? endRaw.toDouble()
        : double.tryParse('$endRaw');
    final end = (parsedEnd != null && parsedEnd > start)
        ? parsedEnd
        : start + _kAdminDiscoverMaxSeconds;
    final discoverEnabled =
        song['discover_enabled'] == true || song['discoverEnabled'] == true;
    final alreadySet = discoverEnabled ||
        song['discover_clip_start_seconds'] != null ||
        song['discoverClipStartSeconds'] != null;

    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ClipWindowSheet(
        audioUrl: audioUrl,
        displayTitle: title,
        durationSeconds: durationSeconds,
        heading: 'Set Discover clip',
        saveLabel: 'Publish to Discover',
        savedMessage: 'Discover clip saved. Rendering…',
        minLength: _kAdminDiscoverMinSeconds,
        maxLength: _kAdminDiscoverMaxSeconds,
        initialStart: start,
        initialEnd: end,
        alreadySet: alreadySet,
        overwriteWarning:
            'A Discover clip is already set (${clipFmtTime(start)} – ${clipFmtTime(end)}). Saving overwrites it.',
        onSave: (s, e) => _songsApi.publishDiscover(
          id,
          clipStartSeconds: s,
          clipEndSeconds: e,
        ),
      ),
    );
    if (updated == true && mounted) {
      await _refreshSongs();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Discover clip published.')),
      );
    }
  }

  Future<void> _showTrimDialog(
    String songId,
    String songTitle, {
    String audioUrl = '',
    int? durationSeconds,
  }) async {
    final maxDur = (durationSeconds != null && durationSeconds > 0)
        ? durationSeconds
        : 180;
    final startCtrl = TextEditingController(text: '0');
    final endCtrl = TextEditingController(
      text: '${maxDur < 30 ? maxDur : 30}',
    );
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Trim: $songTitle'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Song length ≈ ${maxDur}s. Set the keep-range, preview it, then save.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: startCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Start seconds'),
            ),
            TextField(
              controller: endCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'End seconds'),
            ),
          ],
        ),
        actions: [
          if (audioUrl.isNotEmpty)
            TextButton(
              onPressed: () async {
                final start = int.tryParse(startCtrl.text.trim()) ?? 0;
                final end = int.tryParse(endCtrl.text.trim()) ?? 0;
                if (end <= start) return;
                try {
                  await _previewPlayer.setUrl(audioUrl);
                  await _previewPlayer.seek(Duration(seconds: start));
                  await _previewPlayer.play();
                  if (mounted) setState(() => _previewingSongId = songId);
                  // Stop at end of trim window.
                  Future<void>.delayed(Duration(seconds: end - start), () async {
                    if (_previewingSongId == songId) {
                      await _previewPlayer.pause();
                      if (mounted) setState(() {});
                    }
                  });
                } catch (e) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Preview failed: $e')),
                  );
                }
              },
              child: const Text('Preview'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final start = int.tryParse(startCtrl.text.trim()) ?? 0;
              final end = int.tryParse(endCtrl.text.trim()) ?? 0;
              if (end <= start) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('End must be greater than start.'),
                  ),
                );
                return;
              }
              try {
                await _admin.trimSong(songId, start, end);
                if (!context.mounted) return;
                Navigator.pop(context);
                if (!mounted) return;
                ScaffoldMessenger.of(this.context).showSnackBar(
                  const SnackBar(content: Text('Trim saved.')),
                );
                await _refreshSongs();
              } catch (e) {
                if (!context.mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Trim failed: $e')),
                );
              }
            },
            child: const Text('Trim'),
          ),
        ],
      ),
    );
    startCtrl.dispose();
    endCtrl.dispose();
  }
}
