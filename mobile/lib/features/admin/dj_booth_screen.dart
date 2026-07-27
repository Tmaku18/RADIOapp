import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/models/admin_models.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/dj_booth_service.dart';
import '../../core/services/station_events_service.dart';
import '../../core/services/whip_broadcaster.dart';

/// Mobile Admin DJ Booth — matches web `/admin/dj-booth`:
/// station picker, now playing, global transport, mic (WHIP audio → radio),
/// duck level, queue edits, and soundboard play.
class DjBoothScreen extends StatefulWidget {
  const DjBoothScreen({super.key});

  @override
  State<DjBoothScreen> createState() => _DjBoothScreenState();
}

class _DjBoothScreenState extends State<DjBoothScreen> {
  final DjBoothService _booth = DjBoothService();
  final AdminService _admin = AdminService();
  final WhipBroadcaster _micBroadcaster = WhipBroadcaster();

  List<AdminRadio> _radios = const [];
  String? _stationId;

  bool _loading = true;
  bool _busy = false;
  String? _error;

  bool _transportPaused = false;
  bool _micActive = false;
  bool _sessionConnected = false;
  String? _whipUrl;
  double _duckVolume = 0.25;
  bool _publishing = false;

  String _trackTitle = '—';
  String _trackArtist = '';
  String? _artworkUrl;
  int _listenerCount = 0;

  List<_QueueRow> _queueDraft = const [];
  List<String> _originalStackIds = const [];
  List<Map<String, dynamic>> _addCandidates = const [];
  String? _selectedAddStackId;
  List<Map<String, dynamic>> _clips = const [];

  Timer? _pollTimer;
  Timer? _realtimeRefreshTimer;
  StreamSubscription<DjBoothRealtimeEvent>? _eventSub;
  bool _hasQueueEdits = false;

  @override
  void initState() {
    super.initState();
    unawaited(_bootstrap());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _realtimeRefreshTimer?.cancel();
    unawaited(_eventSub?.cancel() ?? Future.value());
    unawaited(() async {
      await _micBroadcaster.dispose();
      if (_publishing) {
        await AudioPlayerService.restoreMusicSession();
      }
    }());
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final radios = await _admin.getRadios();
      if (!mounted) return;
      final initial = radios.isNotEmpty ? radios.first.id : null;
      setState(() {
        _radios = radios;
        _stationId = initial;
        _loading = false;
      });
      if (initial != null) {
        await _selectStation(initial);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _selectStation(String stationId) async {
    _pollTimer?.cancel();
    _realtimeRefreshTimer?.cancel();
    await _eventSub?.cancel();
    // Drop local WHIP if switching stations mid-session.
    if (_publishing) {
      await _micBroadcaster.dispose();
      _publishing = false;
    }
    setState(() {
      _stationId = stationId;
      _hasQueueEdits = false;
      _error = null;
    });
    await StationEventsService().switchStation(stationId);
    _eventSub = StationEventsService().djBoothStream.listen((_) {
      _scheduleRealtimeRefresh();
    });
    await _loadStatus();
    await _loadCandidates();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_loadStatus()),
    );
  }

  void _scheduleRealtimeRefresh() {
    if (_realtimeRefreshTimer?.isActive == true) return;
    _realtimeRefreshTimer = Timer(const Duration(milliseconds: 1500), () {
      unawaited(_loadStatus());
    });
  }

  Future<void> _loadStatus() async {
    final stationId = _stationId;
    if (stationId == null) return;
    try {
      final results = await Future.wait([
        _booth.getStatus(stationId),
        _booth.listSoundboardClips(),
      ]);
      if (!mounted) return;
      final data = results[0] as Map<String, dynamic>;
      final clips = results[1] as List<Map<String, dynamic>>;

      final transport = data['transport'];
      final booth = data['booth'];
      final session = data['session'];
      final currentTrack = data['currentTrack'];
      final queue = data['queue'];

      final paused = transport is Map && transport['paused'] == true;
      final micActive = booth is Map && booth['micActive'] == true;
      final duck = booth is Map
          ? (booth['duckVolume'] as num?)?.toDouble() ?? 0.25
          : 0.25;
      final whip = session is Map
          ? (session['whip_url'] ?? session['whipUrl'])?.toString()
          : null;
      final connected =
          session is Map && (session['status']?.toString() == 'active');

      String title = '—';
      String artist = '';
      String? art;
      int listeners = 0;
      if (currentTrack is Map) {
        title = (currentTrack['title'] ?? title).toString();
        artist = (currentTrack['artist_name'] ??
                currentTrack['artistName'] ??
                '')
            .toString();
        art = (currentTrack['artwork_url'] ?? currentTrack['artworkUrl'])
            ?.toString();
        final raw = currentTrack['listener_count'] ?? currentTrack['listenerCount'];
        if (raw is num) {
          listeners = raw.toInt();
        } else if (raw != null) {
          listeners = int.tryParse(raw.toString()) ?? 0;
        }
      }
      if (queue is Map) {
        final song = queue['currentSong'];
        if (song is Map) {
          if (title == '—' || title.isEmpty) {
            title = (song['title'] ?? title).toString();
          }
          if (artist.isEmpty) {
            artist = (song['artistName'] ?? '').toString();
          }
        }
      }

      List<_QueueRow> draft = _queueDraft;
      List<String> original = _originalStackIds;
      if (!_hasQueueEdits && queue is Map) {
        final upcoming = (queue['upcoming'] as List?) ?? const [];
        draft = upcoming.whereType<Map>().map((row) {
          final m = row.cast<String, dynamic>();
          return _QueueRow(
            stackId: (m['stackId'] ?? '').toString(),
            title: (m['title'] ?? 'Untitled').toString(),
            artistName: (m['artistName'] ?? '').toString(),
            durationSeconds: (m['durationSeconds'] as num?)?.toInt() ?? 0,
          );
        }).where((r) => r.stackId.isNotEmpty).toList();
        original = draft.map((r) => r.stackId).toList();
      }

      setState(() {
        _transportPaused = paused;
        _micActive = micActive;
        _duckVolume = duck;
        _whipUrl = (whip != null && whip.isNotEmpty) ? whip : null;
        _sessionConnected = connected;
        _trackTitle = title;
        _trackArtist = artist;
        _artworkUrl = art;
        _listenerCount = listeners < 0 ? 0 : listeners;
        _queueDraft = draft;
        _originalStackIds = original;
        _clips = clips;
        _error = null;
      });

      // Resume WHIP if a booth session is already open. Only re-assert ON AIR
      // when the server already has micActive (don't force talk-over on open).
      if (connected &&
          _whipUrl != null &&
          !_publishing &&
          !_busy) {
        unawaited(_ensureMicPublishing(goOnAir: micActive));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _loadCandidates() async {
    final stationId = _stationId;
    if (stationId == null) return;
    try {
      final songs = await _admin.getSongsInFreeRotation(stationId);
      if (!mounted) return;
      setState(() {
        _addCandidates = songs;
        _selectedAddStackId = songs.isNotEmpty
            ? (songs.first['id'] ?? songs.first['stackId'])?.toString()
            : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _addCandidates = const []);
    }
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
      await _loadStatus();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _ensureMicPublishing({bool goOnAir = false}) async {
    final whip = _whipUrl;
    final stationId = _stationId;
    if (whip == null || stationId == null || _publishing) return;
    try {
      await AudioPlayerService.prepareForBroadcast();
      await _micBroadcaster.start(whip, video: false);
      if (!mounted) return;
      setState(() => _publishing = true);
      // Mic only goes on-air after WHIP succeeds (same as web MicPanel).
      if (goOnAir) {
        await _booth.micOn(stationId);
        await _loadStatus();
      }
    } catch (e) {
      await _micBroadcaster.dispose();
      try {
        await AudioPlayerService.restoreMusicSession();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _publishing = false;
        _error = 'Mic publish failed: $e';
      });
      try {
        await _booth.micOff(stationId);
      } catch (_) {}
    }
  }

  Future<void> _connectMic() async {
    final stationId = _stationId;
    if (stationId == null) return;
    await _run(() async {
      final session = await _booth.createMicSession(stationId);
      final whip = (session['whipUrl'] ?? session['whip_url'])?.toString();
      if (whip != null && whip.isNotEmpty) {
        setState(() {
          _whipUrl = whip;
          _sessionConnected = true;
        });
        await _ensureMicPublishing(goOnAir: true);
      }
    });
  }

  Future<void> _disconnectMic() async {
    final stationId = _stationId;
    if (stationId == null) return;
    await _run(() async {
      try {
        await _booth.micOff(stationId);
      } catch (_) {}
      await _micBroadcaster.dispose();
      _publishing = false;
      await _booth.deleteMicSession(stationId);
      await AudioPlayerService.restoreMusicSession();
    });
  }

  Future<void> _toggleMicAir() async {
    final stationId = _stationId;
    if (stationId == null) return;
    await _run(() async {
      if (_micActive) {
        await _booth.micOff(stationId);
      } else {
        if (!_publishing && _whipUrl != null) {
          await _ensureMicPublishing(goOnAir: true);
        } else {
          await _booth.micOn(stationId);
        }
      }
    });
  }

  Future<void> _saveDuck(double value) async {
    final stationId = _stationId;
    if (stationId == null) return;
    setState(() => _duckVolume = value);
    try {
      await _booth.setDuckVolume(stationId, value);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  bool get _queueDirty {
    if (_queueDraft.length != _originalStackIds.length) return true;
    for (var i = 0; i < _queueDraft.length; i++) {
      if (_queueDraft[i].stackId != _originalStackIds[i]) return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('DJ Booth'),
        actions: [
          if (_stationId != null)
            IconButton(
              tooltip: 'Refresh',
              onPressed: _busy ? null : () => unawaited(_loadStatus()),
              icon: const Icon(Icons.refresh),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await _loadStatus();
                await _loadCandidates();
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Control the radio player, queue, and mic for any station — same as the web DJ Booth.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_radios.isNotEmpty)
                    DropdownButtonFormField<String>(
                      value: _stationId,
                      decoration: const InputDecoration(
                        labelText: 'Station',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: _radios
                          .map(
                            (r) => DropdownMenuItem(
                              value: r.id,
                              child: Text(r.label.isNotEmpty ? r.label : r.id),
                            ),
                          )
                          .toList(),
                      onChanged: _busy
                          ? null
                          : (id) {
                              if (id != null) unawaited(_selectStation(id));
                            },
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 10,
                        color: _listenerCount > 0
                            ? Colors.green
                            : theme.colorScheme.outline,
                      ),
                      const SizedBox(width: 8),
                      Text('Live listeners: $_listenerCount'),
                    ],
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Material(
                      color: theme.colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          _error!,
                          style: TextStyle(
                            color: theme.colorScheme.onErrorContainer,
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  _NowPlayingCard(
                    title: _trackTitle,
                    artist: _trackArtist,
                    artworkUrl: _artworkUrl,
                    paused: _transportPaused,
                  ),
                  const SizedBox(height: 12),
                  Text('Transport', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    'Global — affects all listeners on this station.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: _busy || _stationId == null
                            ? null
                            : () => _run(() => _booth.skipBack(_stationId!)),
                        child: const Text('◀ Back'),
                      ),
                      FilledButton(
                        onPressed: _busy || _stationId == null
                            ? null
                            : () => _run(() async {
                                  if (_transportPaused) {
                                    await _booth.playTransport(_stationId!);
                                  } else {
                                    await _booth.pauseTransport(_stationId!);
                                  }
                                }),
                        child: Text(
                          _transportPaused
                              ? '▶ Play for everyone'
                              : '⏸ Pause for everyone',
                        ),
                      ),
                      OutlinedButton(
                        onPressed: _busy || _stationId == null
                            ? null
                            : () => _run(() => _booth.skipForward(_stationId!)),
                        child: const Text('Skip ▶'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _MicSection(
                    micActive: _micActive,
                    sessionConnected: _sessionConnected,
                    publishing: _publishing,
                    duckVolume: _duckVolume,
                    busy: _busy,
                    onConnect: _connectMic,
                    onDisconnect: _disconnectMic,
                    onToggleAir: _toggleMicAir,
                    onDuckChanged: _saveDuck,
                  ),
                  const SizedBox(height: 24),
                  _QueueSection(
                    rows: _queueDraft,
                    dirty: _queueDirty,
                    busy: _busy,
                    candidates: _addCandidates,
                    selectedAddStackId: _selectedAddStackId,
                    onSelectAdd: (id) => setState(() => _selectedAddStackId = id),
                    onMove: (from, to) {
                      setState(() {
                        final next = [..._queueDraft];
                        final item = next.removeAt(from);
                        next.insert(to, item);
                        _queueDraft = next;
                        _hasQueueEdits = true;
                      });
                    },
                    onRemove: (index) {
                      setState(() {
                        final next = [..._queueDraft]..removeAt(index);
                        _queueDraft = next;
                        _hasQueueEdits = true;
                      });
                    },
                    onAdd: () {
                      final id = _selectedAddStackId;
                      if (id == null) return;
                      final song = _addCandidates.firstWhere(
                        (s) => (s['id'] ?? s['stackId'])?.toString() == id,
                        orElse: () => {},
                      );
                      setState(() {
                        _queueDraft = [
                          ..._queueDraft,
                          _QueueRow(
                            stackId: id,
                            title: (song['title'] ?? 'Untitled').toString(),
                            artistName: (song['users'] is Map
                                    ? (song['users'] as Map)['display_name']
                                    : null)
                                ?.toString() ??
                                (song['artist_name'] ?? 'Unknown').toString(),
                            durationSeconds:
                                (song['duration_seconds'] as num?)?.toInt() ??
                                    0,
                          ),
                        ];
                        _hasQueueEdits = true;
                      });
                    },
                    onSave: () => _run(() async {
                      await _booth.replaceQueue(
                        _stationId!,
                        _queueDraft.map((r) => r.stackId).toList(),
                      );
                      _hasQueueEdits = false;
                    }),
                    onDiscard: () {
                      setState(() => _hasQueueEdits = false);
                      unawaited(_loadStatus());
                    },
                  ),
                  const SizedBox(height: 24),
                  _SoundboardSection(
                    clips: _clips,
                    busy: _busy,
                    onPlay: (clipId) => _run(
                      () => _booth.playSoundboardClip(_stationId!, clipId),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

class _QueueRow {
  final String stackId;
  final String title;
  final String artistName;
  final int durationSeconds;

  const _QueueRow({
    required this.stackId,
    required this.title,
    required this.artistName,
    required this.durationSeconds,
  });
}

class _NowPlayingCard extends StatelessWidget {
  const _NowPlayingCard({
    required this.title,
    required this.artist,
    required this.artworkUrl,
    required this.paused,
  });

  final String title;
  final String artist;
  final String? artworkUrl;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: artworkUrl != null && artworkUrl!.isNotEmpty
                ? Image.network(
                    artworkUrl!,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => _artPlaceholder(theme),
                  )
                : _artPlaceholder(theme),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NOW PLAYING',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium,
                ),
                if (artist.isNotEmpty)
                  Text(
                    artist,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                if (paused)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'PAUSED FOR EVERYONE',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _artPlaceholder(ThemeData theme) => Container(
        width: 72,
        height: 72,
        color: theme.colorScheme.surfaceContainerHighest,
        child: Icon(Icons.music_note, color: theme.colorScheme.outline),
      );
}

class _MicSection extends StatelessWidget {
  const _MicSection({
    required this.micActive,
    required this.sessionConnected,
    required this.publishing,
    required this.duckVolume,
    required this.busy,
    required this.onConnect,
    required this.onDisconnect,
    required this.onToggleAir,
    required this.onDuckChanged,
  });

  final bool micActive;
  final bool sessionConnected;
  final bool publishing;
  final double duckVolume;
  final bool busy;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;
  final VoidCallback onToggleAir;
  final ValueChanged<double> onDuckChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Mic Booth', style: theme.textTheme.titleMedium),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: micActive
                    ? Colors.red
                    : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                micActive ? 'ON AIR' : 'OFF AIR',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: micActive
                      ? Colors.white
                      : theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            if (publishing) ...[
              const SizedBox(width: 8),
              Text(
                'Publishing',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Audio-only talk-over for station listeners (same Cloudflare path as web).',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (!sessionConnected)
              FilledButton(
                onPressed: busy ? null : onConnect,
                child: const Text('Connect Mic'),
              )
            else ...[
              OutlinedButton(
                onPressed: busy ? null : onDisconnect,
                child: const Text('Disconnect'),
              ),
              FilledButton(
                style: micActive
                    ? FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.error,
                      )
                    : null,
                onPressed: busy ? null : onToggleAir,
                child: Text(micActive ? 'Mic Off' : 'Mic On'),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'Music duck while mic is on: ${(duckVolume * 100).round()}%',
          style: theme.textTheme.bodySmall,
        ),
        Slider(
          value: duckVolume.clamp(0.05, 0.5),
          min: 0.05,
          max: 0.5,
          divisions: 9,
          label: '${(duckVolume * 100).round()}%',
          onChanged: busy ? null : (v) => onDuckChanged(v),
        ),
      ],
    );
  }
}

class _QueueSection extends StatelessWidget {
  const _QueueSection({
    required this.rows,
    required this.dirty,
    required this.busy,
    required this.candidates,
    required this.selectedAddStackId,
    required this.onSelectAdd,
    required this.onMove,
    required this.onRemove,
    required this.onAdd,
    required this.onSave,
    required this.onDiscard,
  });

  final List<_QueueRow> rows;
  final bool dirty;
  final bool busy;
  final List<Map<String, dynamic>> candidates;
  final String? selectedAddStackId;
  final ValueChanged<String?> onSelectAdd;
  final void Function(int from, int to) onMove;
  final ValueChanged<int> onRemove;
  final VoidCallback onAdd;
  final VoidCallback onSave;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Up next', style: theme.textTheme.titleMedium),
        const SizedBox(height: 8),
        if (rows.isEmpty)
          Text(
            'Queue is empty.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          ...List.generate(rows.length, (i) {
            final row = rows[i];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text(row.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(
                row.artistName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_upward, size: 18),
                    onPressed: busy || i == 0 ? null : () => onMove(i, i - 1),
                  ),
                  IconButton(
                    icon: const Icon(Icons.arrow_downward, size: 18),
                    onPressed: busy || i >= rows.length - 1
                        ? null
                        : () => onMove(i, i + 1),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: busy ? null : () => onRemove(i),
                  ),
                ],
              ),
            );
          }),
        if (candidates.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: selectedAddStackId,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Add free-rotation song',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: candidates.map((s) {
                    final id = (s['id'] ?? s['stackId'])?.toString() ?? '';
                    final title = (s['title'] ?? 'Untitled').toString();
                    return DropdownMenuItem(value: id, child: Text(title));
                  }).toList(),
                  onChanged: busy ? null : onSelectAdd,
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                onPressed: busy || selectedAddStackId == null ? null : onAdd,
                child: const Text('Add'),
              ),
            ],
          ),
        ],
        if (dirty) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              FilledButton(
                onPressed: busy ? null : onSave,
                child: const Text('Save queue'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: busy ? null : onDiscard,
                child: const Text('Discard'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _SoundboardSection extends StatelessWidget {
  const _SoundboardSection({
    required this.clips,
    required this.busy,
    required this.onPlay,
  });

  final List<Map<String, dynamic>> clips;
  final bool busy;
  final ValueChanged<String> onPlay;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Soundboard', style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          'Play a clip for all listeners on this station.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        if (clips.isEmpty)
          Text(
            'No clips yet. Upload them from the web DJ Booth.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: clips.map((c) {
              final id = c['id']?.toString() ?? '';
              final name = (c['name'] ?? 'Clip').toString();
              return ActionChip(
                label: Text(name),
                onPressed: busy || id.isEmpty ? null : () => onPlay(id),
              );
            }).toList(),
          ),
      ],
    );
  }
}
