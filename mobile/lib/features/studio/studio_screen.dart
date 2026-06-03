import 'dart:async';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/song.dart';
import '../../core/services/refinery_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/payments_service.dart';
import '../../core/theme/networx_extensions.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key});

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen> {
  final SongsService _songs = SongsService();
  final RefineryService _refinery = RefineryService();
  bool _loading = true;
  List<Song> _items = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.getUserProfile();
      final items = await _songs.getMine();
      if (!mounted) return;
      setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _likeTimeAgo(DateTime? dt) {
    if (dt == null) return 'Recently';
    final local = dt.toLocal();
    final diff = DateTime.now().difference(local);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${local.month}/${local.day}/${local.year}';
  }

  Future<void> _showLikesSheet(Song song) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        final surfaces = context.networxSurfaces;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: FutureBuilder<SongLikesResponse>(
              future: _songs.getLikes(song.id),
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const SizedBox(
                    height: 220,
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snap.hasError) {
                  return SizedBox(
                    height: 220,
                    child: Center(
                      child: Text(
                        'Could not load likes.',
                        style: TextStyle(color: surfaces.textSecondary),
                      ),
                    ),
                  );
                }
                final data = snap.data ??
                    const SongLikesResponse(totalLikes: 0, likes: <SongLikeUser>[]);
                return SizedBox(
                  height: MediaQuery.of(context).size.height * 0.6,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Likes for "${song.title}" (${data.totalLikes})',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 12),
                      if (data.likes.isEmpty)
                        Expanded(
                          child: Center(
                            child: Text(
                              'No likes yet.',
                              style: TextStyle(color: surfaces.textSecondary),
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            itemCount: data.likes.length,
                            separatorBuilder: (context, index) =>
                                const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final like = data.likes[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  backgroundImage:
                                      (like.avatarUrl ?? '').trim().isNotEmpty
                                      ? NetworkImage(like.avatarUrl!)
                                      : null,
                                  child: (like.avatarUrl ?? '').trim().isEmpty
                                      ? const Icon(Icons.person_outline)
                                      : null,
                                ),
                                title: Text(
                                  like.displayName?.trim().isNotEmpty == true
                                      ? like.displayName!
                                      : 'Unknown user',
                                ),
                                subtitle: Text(_likeTimeAgo(like.likedAt)),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _openPayouts() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _PayoutsSheet(),
    );
  }

  Future<void> _openSampleTrim(Song song) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _SampleTrimSheet(song: song),
    );
    if (updated == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Songs'),
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
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Manage your uploaded songs and track performance',
                          style: TextStyle(
                            color: surfaces.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.end,
                          children: [
                            FilledButton.icon(
                              onPressed: () {
                                Navigator.pushNamed(context, AppRoutes.upload)
                                    .then((_) => _load());
                              },
                              icon: const Icon(Icons.upload),
                              label: const Text('Upload New Song'),
                            ),
                            OutlinedButton.icon(
                              onPressed: () {
                                Navigator.pushNamed(
                                        context, AppRoutes.liveServices)
                                    .then((_) => _load());
                              },
                              icon: const Icon(Icons.event_available_outlined),
                              label: const Text('Live services'),
                            ),
                            OutlinedButton.icon(
                              onPressed: _openPayouts,
                              icon: const Icon(Icons.payments_outlined),
                              label: const Text('Payouts'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Tracks',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontFamily: 'Lora'),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.pushNamed(context, AppRoutes.credits).then((_) => _load());
                      },
                      child: const Text('History'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_items.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        'No songs yet. Upload your first song to get on the radio.',
                        style: TextStyle(color: surfaces.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else
                  ..._items.map((s) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              ListTile(
                                title: Text(
                                  s.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  '${s.status} · ${s.playCount} discoveries · ${s.likeCount} likes',
                                  style: TextStyle(color: surfaces.textSecondary),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${s.creditsRemaining}',
                                          style: TextStyle(
                                              color: scheme.primary,
                                              fontWeight: FontWeight.w700),
                                        ),
                                        Text(
                                          'plays',
                                          style: TextStyle(
                                              color: surfaces.textMuted,
                                              fontSize: 12),
                                        ),
                                      ],
                                    ),
                                    if (s.status == 'approved') ...[
                                      const SizedBox(width: 4),
                                      OutlinedButton(
                                        onPressed: () {
                                          Navigator.pushNamed(
                                            context,
                                            AppRoutes.allocatePlays,
                                            arguments: s,
                                          ).then((_) => _load());
                                        },
                                        child: const Text('Allocate'),
                                      ),
                                      const SizedBox(width: 4),
                                      FilledButton(
                                        onPressed: () {
                                          Navigator.pushNamed(
                                            context,
                                            AppRoutes.buyPlays,
                                            arguments: s,
                                          ).then((result) {
                                            if (result == true) _load();
                                          });
                                        },
                                        child: const Text('Buy plays'),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              if (s.status == 'approved')
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                                  child: Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      if (s.inRefinery)
                                        Chip(
                                          label: const Text('In The Refinery'),
                                          avatar: Icon(
                                            Icons.science_outlined,
                                            size: 18,
                                            color: scheme.primary,
                                          ),
                                        ),
                                      if (s.inRefinery)
                                        TextButton.icon(
                                          onPressed: () => Navigator.pushNamed(
                                            context,
                                            AppRoutes.refineryAnalytics,
                                            arguments: s.id,
                                          ),
                                          icon: const Icon(Icons.bar_chart),
                                          label: const Text('View reviews'),
                                        ),
                                      TextButton.icon(
                                        onPressed: () => _showLikesSheet(s),
                                        icon: const Icon(Icons.favorite_border),
                                        label: const Text('View likes'),
                                      ),
                                      TextButton.icon(
                                        onPressed: () => _openSampleTrim(s),
                                        icon: const Icon(Icons.cut),
                                        label: const Text('Set sample'),
                                      ),
                                      TextButton.icon(
                                        onPressed: s.inRefinery
                                            ? null
                                            : () async {
                                                final messenger =
                                                    ScaffoldMessenger.of(context);
                                                try {
                                                  await _refinery
                                                      .addSongToRefinery(s.id);
                                                  if (mounted) await _load();
                                                } catch (e) {
                                                  if (mounted) {
                                                    messenger.showSnackBar(
                                                      SnackBar(
                                                          content: Text(
                                                              'Refinery: $e')),
                                                    );
                                                  }
                                                }
                                              },
                                        icon: const Icon(Icons.add_circle_outline),
                                        label: const Text('Add to Refinery'),
                                      ),
                                      TextButton.icon(
                                        onPressed: !s.inRefinery
                                            ? null
                                            : () async {
                                                final messenger =
                                                    ScaffoldMessenger.of(context);
                                                try {
                                                  await _refinery
                                                      .removeSongFromRefinery(
                                                          s.id);
                                                  if (mounted) await _load();
                                                } catch (e) {
                                                  if (mounted) {
                                                    messenger.showSnackBar(
                                                      SnackBar(
                                                          content: Text(
                                                              'Refinery: $e')),
                                                    );
                                                  }
                                                }
                                              },
                                        icon: const Icon(Icons.remove_circle_outline),
                                        label: const Text('Remove from Refinery'),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                      )),
              ],
            ),
    );
  }
}

const int _kSampleLengthSeconds = 30;

String _fmtTime(int totalSeconds) {
  final s = totalSeconds < 0 ? 0 : totalSeconds;
  final m = s ~/ 60;
  final rem = s % 60;
  return '$m:${rem.toString().padLeft(2, '0')}';
}

/// Lets an artist pick the 30-second sample window for one of their songs.
class _SampleTrimSheet extends StatefulWidget {
  final Song song;
  const _SampleTrimSheet({required this.song});

  @override
  State<_SampleTrimSheet> createState() => _SampleTrimSheetState();
}

class _SampleTrimSheetState extends State<_SampleTrimSheet> {
  final SongsService _songs = SongsService();
  final AudioPlayer _player = AudioPlayer();
  int _duration = 0;
  int _start = 0;
  bool _saving = false;
  bool _previewing = false;
  Timer? _stopTimer;

  @override
  void initState() {
    super.initState();
    _duration = widget.song.durationSeconds ?? 0;
    _start = widget.song.sampleStartSeconds;
    _prepare();
  }

  Future<void> _prepare() async {
    final url = widget.song.audioUrl;
    if (url.isEmpty) return;
    try {
      final dur = await _player.setUrl(url);
      if (!mounted) return;
      if (dur != null && dur.inSeconds > 0) {
        setState(() {
          if (_duration <= 0) _duration = dur.inSeconds;
        });
      }
    } catch (_) {
      // Preview unavailable; saving still works.
    }
  }

  int get _maxStart {
    final d = _duration > 0 ? _duration : _kSampleLengthSeconds;
    final m = d - _kSampleLengthSeconds;
    return m < 0 ? 0 : m;
  }

  int get _end {
    final d = _duration > 0 ? _duration : _start + _kSampleLengthSeconds;
    final e = _start + _kSampleLengthSeconds;
    return e > d ? d : e;
  }

  Future<void> _preview() async {
    _stopTimer?.cancel();
    try {
      await _player.seek(Duration(seconds: _start));
      await _player.play();
      if (!mounted) return;
      setState(() => _previewing = true);
      _stopTimer = Timer(const Duration(seconds: _kSampleLengthSeconds), () async {
        try {
          await _player.pause();
        } catch (_) {}
        if (mounted) setState(() => _previewing = false);
      });
    } catch (_) {
      if (mounted) setState(() => _previewing = false);
    }
  }

  Future<void> _stopPreview() async {
    _stopTimer?.cancel();
    try {
      await _player.pause();
    } catch (_) {}
    if (mounted) setState(() => _previewing = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _songs.setSample(widget.song.id, _start);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sample saved. Rendering preview…')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not save sample: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _stopTimer?.cancel();
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          8,
          16,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Set 30-second sample',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              widget.song.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: surfaces.textSecondary),
            ),
            const SizedBox(height: 16),
            Text(
              'Sample window: ${_fmtTime(_start)} – ${_fmtTime(_end)}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            Slider(
              value: _start.toDouble().clamp(0, _maxStart.toDouble()),
              min: 0,
              max: _maxStart.toDouble() <= 0 ? 1 : _maxStart.toDouble(),
              divisions: _maxStart > 0 ? _maxStart : null,
              label: _fmtTime(_start),
              onChanged: _maxStart <= 0
                  ? null
                  : (v) {
                      _stopPreview();
                      setState(() => _start = v.round());
                    },
            ),
            Text(
              _duration > 0
                  ? 'Track length: ${_fmtTime(_duration)}'
                  : 'Drag to choose where the 30-second preview starts.',
              style: TextStyle(color: surfaces.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _previewing ? _stopPreview : _preview,
                  icon: Icon(_previewing ? Icons.stop : Icons.play_arrow),
                  label: Text(_previewing ? 'Stop' : 'Preview'),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save sample'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Stripe Connect onboarding + payout status for artists.
class _PayoutsSheet extends StatefulWidget {
  const _PayoutsSheet();

  @override
  State<_PayoutsSheet> createState() => _PayoutsSheetState();
}

class _PayoutsSheetState extends State<_PayoutsSheet> {
  final PaymentsService _payments = PaymentsService();
  bool _loading = true;
  bool _working = false;
  Map<String, dynamic> _status = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await _payments.getConnectStatus();
      if (!mounted) return;
      setState(() => _status = res);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _payoutsEnabled => _status['payoutsEnabled'] == true;
  bool get _detailsSubmitted => _status['detailsSubmitted'] == true;
  bool get _hasAccount =>
      (_status['accountId']?.toString().isNotEmpty ?? false) ||
      _detailsSubmitted ||
      _payoutsEnabled;

  Future<void> _openExternal(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _startOnboarding() async {
    setState(() => _working = true);
    try {
      final res = await _payments.startConnectOnboarding();
      final url = (res['url'] ?? res['onboardingUrl'])?.toString();
      if (url == null || url.isEmpty) {
        throw Exception('Could not start onboarding.');
      }
      await _openExternal(url);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Finish setup in the browser, then reopen Payouts.'),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Onboarding failed: $e')));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _openDashboard() async {
    setState(() => _working = true);
    try {
      final res = await _payments.createConnectLoginLink();
      final url = (res['url'] ?? res['loginUrl'])?.toString();
      await _openExternal(url);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not open dashboard: $e')));
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: _loading
            ? const SizedBox(
                height: 160,
                child: Center(child: CircularProgressIndicator()),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Artist payouts',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Connect a payout account to get paid automatically when '
                    'listeners buy your songs.',
                    style: TextStyle(color: surfaces.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Icon(
                        _payoutsEnabled
                            ? Icons.check_circle
                            : Icons.pending_outlined,
                        color: _payoutsEnabled ? Colors.green : scheme.primary,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _payoutsEnabled
                              ? 'Payouts enabled — you’re ready to sell.'
                              : _hasAccount
                                  ? 'Setup started — finish verification to enable payouts.'
                                  : 'Not set up yet.',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_payoutsEnabled)
                    OutlinedButton.icon(
                      onPressed: _working ? null : _openDashboard,
                      icon: const Icon(Icons.open_in_new),
                      label: const Text('Open payout dashboard'),
                    )
                  else
                    FilledButton.icon(
                      onPressed: _working ? null : _startOnboarding,
                      icon: _working
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.account_balance_outlined),
                      label: Text(
                        _hasAccount ? 'Continue setup' : 'Set up payouts',
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: _working ? null : _load,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Refresh status'),
                  ),
                ],
              ),
      ),
    );
  }
}


