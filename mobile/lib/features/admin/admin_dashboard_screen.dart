import 'package:flutter/material.dart';
import '../../core/models/admin_models.dart';
import '../../core/services/admin_service.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final AdminService _admin = AdminService();

  bool _loading = true;
  bool _liveActionLoading = false;
  String? _error;
  Map<String, dynamic> _analytics = {};
  Map<String, dynamic> _liveStatus = {'active': false};

  List<Map<String, dynamic>> _songs = const [];
  List<AdminRadio> _radios = const [];
  List<AdminQueueItem> _queue = const [];
  String? _selectedRadioId;
  List<Map<String, dynamic>> _users = const [];
  List<Map<String, dynamic>> _swipeCards = const [];
  List<Map<String, dynamic>> _feedMedia = const [];
  List<Map<String, dynamic>> _fallbackGroups = const [];
  List<Map<String, dynamic>> _freeRotationSongs = const [];
  List<Map<String, dynamic>> _streamerApplications = const [];

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

  Future<void> _loadInitial() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final analytics = await _admin.getAnalytics();
      final liveStatus = await _admin.getLiveStatus();
      final radios = await _admin.getRadios();
      final songs = await _admin.getSongs(limit: 100, status: 'all');
      final users = await _admin.getUsers(limit: 100);
      final swipeCards = await _admin.getSwipeCards(limit: 100);
      final feed = await _admin.getFeedMedia();
      final fallback = await _admin.getFallbackSongsGrouped();
      final freeRotation = await _admin.getSongsInFreeRotation();
      final streamers = await _admin.getStreamerApplications();

      String? selectedRadioId = _selectedRadioId;
      List<AdminQueueItem> queue = const [];
      if (radios.isNotEmpty) {
        selectedRadioId ??= radios.first.id;
        final queueRes = await _admin.getRadioQueue(selectedRadioId, limit: 200);
        queue = queueRes.parseUpcomingQueue();
        _queueDraftCtrl.text = queue.map((e) => e.stackId).join('\n');
      }

      if (!mounted) return;
      setState(() {
        _analytics = analytics;
        _liveStatus = liveStatus;
        _radios = radios;
        _songs = songs;
        _users = users;
        _swipeCards = swipeCards;
        _feedMedia = feed;
        _fallbackGroups = fallback;
        _freeRotationSongs = freeRotation;
        _streamerApplications = streamers;
        _selectedRadioId = selectedRadioId;
        _queue = queue;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _refreshQueue() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    final queueRes = await _admin.getRadioQueue(radioId, limit: 200);
    final queue = queueRes.parseUpcomingQueue();
    if (!mounted) return;
    setState(() {
      _queue = queue;
      _queueDraftCtrl.text = queue.map((e) => e.stackId).join('\n');
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
    final songs = await _admin.getSongs(
      limit: 100,
      status: 'all',
      search: _songSearchCtrl.text.trim().isEmpty ? null : _songSearchCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _songs = songs);
  }

  Future<void> _refreshUsers() async {
    final users = await _admin.getUsers(
      limit: 100,
      search: _userSearchCtrl.text.trim().isEmpty ? null : _userSearchCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _users = users);
  }

  Future<void> _saveQueueDraft() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    final stackIds = _queueDraftCtrl.text
        .split('\n')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    await _admin.replaceRadioQueue(radioId, stackIds);
    await _refreshQueue();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Queue replaced successfully.')),
    );
  }

  Future<void> _skipCurrentTrack() async {
    final radioId = _selectedRadioId;
    if (radioId == null || radioId.isEmpty) return;
    await _admin.skipRadioQueueTrack(radioId);
    await _refreshQueue();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Skipped current track.')),
    );
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
      return Scaffold(
        appBar: AppBar(title: Text('Admin Dashboard')),
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin Dashboard')),
        body: Center(child: Text(_error!)),
      );
    }

    return DefaultTabController(
      length: 7,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Admin Dashboard'),
          actions: [
            IconButton(onPressed: _loadInitial, icon: const Icon(Icons.refresh)),
          ],
          bottom: const TabBar(
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
        ),
        body: TabBarView(
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
      ],
    );
  }

  Widget _buildSongsTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _songSearchCtrl,
                decoration: const InputDecoration(
                  labelText: 'Search songs',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshSongs, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 12),
        ..._songs.map((song) {
          final id = '${song['id']}';
          final title = '${song['title'] ?? 'Untitled'}';
          final artist = '${song['artist_name'] ?? 'Unknown artist'}';
          final status = '${song['status'] ?? 'unknown'}';
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('$artist · $status', style: const TextStyle(color: Colors.grey)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: () async {
                          await _admin.updateSongStatus(id, 'approved');
                          await _refreshSongs();
                        },
                        child: const Text('Approve'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          await _admin.updateSongStatus(id, 'rejected');
                          await _refreshSongs();
                        },
                        child: const Text('Reject'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          await _admin.toggleFreeRotation(
                            id,
                            song['admin_free_rotation'] != true,
                          );
                          await _refreshSongs();
                        },
                        child: const Text('Toggle Free Rotation'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          await _showTrimDialog(id, title);
                        },
                        child: const Text('Trim'),
                      ),
                      TextButton(
                        onPressed: () async {
                          await _admin.deleteSong(id);
                          await _refreshSongs();
                        },
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
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                key: ValueKey<String?>(_selectedRadioId),
                initialValue: _selectedRadioId,
                decoration: const InputDecoration(
                  labelText: 'Station',
                  border: OutlineInputBorder(),
                ),
                items: _radios
                    .map(
                      (r) => DropdownMenuItem<String>(
                        value: r.id,
                        child: Text(r.label),
                      ),
                    )
                    .toList(),
                onChanged: (value) async {
                  if (value == null) return;
                  setState(() => _selectedRadioId = value);
                  await _refreshQueue();
                },
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _skipCurrentTrack, child: const Text('Skip Current')),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _queueDraftCtrl,
          minLines: 6,
          maxLines: 12,
          decoration: const InputDecoration(
            labelText: 'Queue Stack IDs (one per line)',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(onPressed: _saveQueueDraft, child: const Text('Replace Queue')),
        const SizedBox(height: 12),
        const Text('Upcoming Queue', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        ..._queue.map(
          (entry) => Card(
            child: ListTile(
              title: Text(entry.title.isEmpty ? entry.normalizedSongId : entry.title),
              subtitle: Text('Stack: ${entry.stackId} · ${entry.artistName}'),
              trailing: IconButton(
                onPressed: () async {
                  if (_selectedRadioId == null) return;
                  await _admin.removeRadioQueueEntry(
                    _selectedRadioId!,
                    stackId: entry.stackId,
                    source: entry.source,
                  );
                  await _refreshQueue();
                },
                icon: const Icon(Icons.delete_outline),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildUsersTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _userSearchCtrl,
                decoration: const InputDecoration(
                  labelText: 'Search users',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshUsers, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 12),
        ..._users.map((user) {
          final userId = '${user['id']}';
          final role = '${user['role'] ?? 'listener'}';
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${user['display_name'] ?? 'Unnamed'}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('${user['email'] ?? ''} · $role'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: () async {
                          await _admin.updateUserRole(userId, role == 'artist' ? 'listener' : 'artist');
                          await _refreshUsers();
                        },
                        child: const Text('Toggle Artist'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          await _admin.lifetimeBanUser(userId, 'Lifetime ban by admin');
                          await _refreshUsers();
                        },
                        child: const Text('Lifetime Ban'),
                      ),
                      TextButton(
                        onPressed: () async {
                          await _admin.deleteUserAccount(userId);
                          await _refreshUsers();
                        },
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
          (item) => Card(
            child: ListTile(
              title: Text('${item['authorDisplayName'] ?? 'Unknown'}'),
              subtitle: Text('${item['caption'] ?? ''}'),
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
          ),
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

  Future<void> _showTrimDialog(String songId, String songTitle) async {
    final startCtrl = TextEditingController(text: '0');
    final endCtrl = TextEditingController(text: '30');
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Trim: $songTitle'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
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
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final start = int.tryParse(startCtrl.text.trim()) ?? 0;
              final end = int.tryParse(endCtrl.text.trim()) ?? 0;
              if (end <= start) return;
              await _admin.trimSong(songId, start, end);
              if (!context.mounted) return;
              Navigator.pop(context);
              if (!mounted) return;
              ScaffoldMessenger.of(this.context).showSnackBar(
                const SnackBar(content: Text('Trim started/saved.')),
              );
              await _refreshSongs();
            },
            child: const Text('Trim'),
          ),
        ],
      ),
    );
  }
}
