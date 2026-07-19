import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/brand/brand_assets.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/song.dart';
import '../../core/services/audio_player_service.dart';
import '../../core/services/refinery_service.dart';
import '../../core/services/songs_service.dart';
import '../../core/services/payments_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../../widgets/clip_window_sheet.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key});

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen> {
  final SongsService _songs = SongsService();
  final RefineryService _refinery = RefineryService();
  final AudioPlayer _player = AudioPlayerService().player;
  bool _loading = true;
  List<Song> _items = const [];
  String? _activeSongId;
  String? _preparingSongId;
  bool _isPlaying = false;
  StreamSubscription<PlayerState>? _playerStateSub;

  @override
  void initState() {
    super.initState();
    _load();
    _playerStateSub = _player.playerStateStream.listen((s) {
      if (!mounted) return;
      setState(() => _isPlaying = s.playing);
    });
  }

  @override
  void dispose() {
    _playerStateSub?.cancel();
    super.dispose();
  }

  /// Artists always stream their own uploads in full — the backend entitles
  /// the uploader, so /songs/:id/stream returns a signed full-length URL.
  Future<void> _playFull(Song song) async {
    if (_activeSongId == song.id) {
      if (_isPlaying) {
        await _player.pause();
      } else {
        await _player.play();
      }
      return;
    }
    if (_preparingSongId != null) return;
    setState(() => _preparingSongId = song.id);
    try {
      final url = (await _songs.getStreamUrl(song.id)) ??
          (song.audioUrl.isNotEmpty ? song.audioUrl : null);
      if (url == null || url.isEmpty) {
        throw Exception('No playable audio for this song yet.');
      }
      await AudioPlayerService().loadSource(
        AudioSource.uri(
          Uri.parse(url),
          tag: MediaItem(
            id: song.id,
            title: song.title,
            artist: song.artistName,
            artUri: BrandAssets.mediaArtUri(song.artworkUrl),
            // Own upload — seekable in the bottom bar (not radio-locked).
            extras: const {'source': 'discography'},
          ),
        ),
      );
      await _player.play();
      if (!mounted) return;
      setState(() => _activeSongId = song.id);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not play this song: $e')),
      );
    } finally {
      if (mounted) setState(() => _preparingSongId = null);
    }
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
    final double start = song.sampleStartSeconds;
    final double end =
        (song.sampleEndSeconds != null && song.sampleEndSeconds! > start)
            ? song.sampleEndSeconds!
            : start + _kSampleLengthSeconds;
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ClipWindowSheet(
        audioUrl: song.audioUrl,
        displayTitle: song.title,
        durationSeconds: song.durationSeconds,
        heading: 'Set preview sample',
        saveLabel: 'Save sample',
        savedMessage: 'Sample saved. Rendering preview…',
        minLength: _kSampleMinSeconds,
        maxLength: _kSampleLengthSeconds,
        initialStart: start,
        initialEnd: end,
        alreadySet: song.sampleUrl != null || song.sampleStartSeconds > 0,
        overwriteWarning:
            'A sample is already set (${clipFmtTime(start)} – ${clipFmtTime(end)}). Saving overwrites it.',
        onSave: (s, e) =>
            _songs.setSample(song.id, s, endSeconds: e),
      ),
    );
    if (updated == true && mounted) await _load();
  }

  Future<void> _openLyricsEditor(Song song) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _LyricsSheet(song: song, songsService: _songs),
    );
  }

  Future<void> _openDiscoverClip(Song song) async {
    final double start = song.discoverClipStartSeconds ?? 0;
    final double? storedEnd = song.discoverClipEndSeconds;
    final double end = (storedEnd != null && storedEnd > start)
        ? storedEnd
        : start + _kDiscoverClipMaxSeconds;
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ClipWindowSheet(
        audioUrl: song.audioUrl,
        displayTitle: song.title,
        durationSeconds: song.durationSeconds,
        heading: 'Set Discover clip',
        saveLabel: 'Publish to Discover',
        savedMessage: 'Discover clip saved. Rendering…',
        minLength: _kDiscoverClipMinSeconds,
        maxLength: _kDiscoverClipMaxSeconds,
        initialStart: start,
        initialEnd: end,
        alreadySet:
            song.discoverEnabled || song.discoverClipStartSeconds != null,
        overwriteWarning:
            'A Discover clip is already set (${clipFmtTime(start)} – ${clipFmtTime(end)}). Saving overwrites it.',
        onSave: (s, e) => _songs.publishDiscover(
          song.id,
          clipStartSeconds: s,
          clipEndSeconds: e,
        ),
      ),
    );
    if (updated == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
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
                        style: DimensionTypography.cardTitle(fontSize: 20),
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
                                leading: _PlayFullButton(
                                  song: s,
                                  isActive: _activeSongId == s.id,
                                  isPlaying:
                                      _activeSongId == s.id && _isPlaying,
                                  isPreparing: _preparingSongId == s.id,
                                  onPressed: () => _playFull(s),
                                ),
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
                                        icon: Icon(
                                          (s.sampleUrl != null ||
                                                  s.sampleStartSeconds > 0)
                                              ? Icons.check_circle_outline
                                              : Icons.cut,
                                        ),
                                        label: Text(
                                          (s.sampleUrl != null ||
                                                  s.sampleStartSeconds > 0)
                                              ? 'Edit sample'
                                              : 'Set sample',
                                        ),
                                      ),
                                      TextButton.icon(
                                        onPressed: () => _openDiscoverClip(s),
                                        icon: Icon(
                                          (s.discoverEnabled ||
                                                  s.discoverClipStartSeconds !=
                                                      null)
                                              ? Icons.check_circle_outline
                                              : Icons.swipe_outlined,
                                        ),
                                        label: Text(
                                          (s.discoverEnabled ||
                                                  s.discoverClipStartSeconds !=
                                                      null)
                                              ? 'Edit Discover clip'
                                              : 'Set Discover clip',
                                        ),
                                      ),
                                      TextButton.icon(
                                        onPressed: () => _openLyricsEditor(s),
                                        icon: const Icon(Icons.lyrics_outlined),
                                        label: const Text('Lyrics'),
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

/// Artwork thumbnail with a play/pause overlay so artists can listen to their
/// own uploads in full straight from My Songs.
class _PlayFullButton extends StatelessWidget {
  const _PlayFullButton({
    required this.song,
    required this.isActive,
    required this.isPlaying,
    required this.isPreparing,
    required this.onPressed,
  });

  final Song song;
  final bool isActive;
  final bool isPlaying;
  final bool isPreparing;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final artwork = (song.artworkUrl ?? '').trim();
    return InkWell(
      onTap: isPreparing ? null : onPressed,
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: 48,
        height: 48,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: artwork.isNotEmpty
                  ? Image.network(
                      artwork,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => ColoredBox(
                        color: scheme.surfaceContainerHighest,
                        child: const Icon(Icons.music_note),
                      ),
                    )
                  : ColoredBox(
                      color: scheme.surfaceContainerHighest,
                      child: const Icon(Icons.music_note),
                    ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: isActive ? 0.45 : 0.35),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: isPreparing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(
                        isPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const int _kSampleLengthSeconds = 30;
const int _kSampleMinSeconds = 5;
const int _kDiscoverClipMaxSeconds = 15;
const int _kDiscoverClipMinSeconds = 5;

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

/// Bottom sheet for viewing/editing a song's lyrics. Saved text is
/// automatically force-aligned to the audio server-side (closed captions).
class _LyricsSheet extends StatefulWidget {
  const _LyricsSheet({required this.song, required this.songsService});

  final Song song;
  final SongsService songsService;

  @override
  State<_LyricsSheet> createState() => _LyricsSheetState();
}

class _LyricsSheetState extends State<_LyricsSheet> {
  final TextEditingController _controller = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String _status = 'none';
  bool _autoGenerated = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final lyrics = await widget.songsService.getLyrics(widget.song.id);
      if (!mounted) return;
      setState(() {
        _controller.text = lyrics?.plainText ?? '';
        _status = lyrics?.status ?? 'none';
        _autoGenerated = lyrics?.autoGenerated ?? false;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = await widget.songsService.upsertLyrics(
        widget.song.id,
        _controller.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _status = saved?.status ?? _status;
        // Saving artist text replaces any auto-transcribed version.
        _autoGenerated = saved?.autoGenerated ?? false;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _controller.text.trim().isEmpty
                ? 'Lyrics removed.'
                : 'Lyrics saved. Captions are syncing to your track…',
          ),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Could not save lyrics: $e';
      });
    }
  }

  Widget? _statusChip(ColorScheme scheme) {
    switch (_status) {
      case 'pending':
        return Chip(
          visualDensity: VisualDensity.compact,
          avatar: const SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          label: const Text('Syncing…'),
        );
      case 'ready':
        return Chip(
          visualDensity: VisualDensity.compact,
          avatar: Icon(Icons.check_circle, size: 16, color: scheme.primary),
          label: const Text('Synced'),
        );
      case 'failed':
        return Chip(
          visualDensity: VisualDensity.compact,
          avatar: Icon(Icons.error_outline, size: 16, color: scheme.error),
          label: const Text('Sync failed'),
        );
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final surfaces = context.networxSurfaces;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final chip = _statusChip(scheme);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 8, 16, 16 + bottomInset),
        child: _loading
            ? const SizedBox(
                height: 220,
                child: Center(child: CircularProgressIndicator()),
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Lyrics — ${widget.song.title}',
                          style: Theme.of(context).textTheme.titleMedium,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (_autoGenerated)
                        Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: Chip(
                            visualDensity: VisualDensity.compact,
                            avatar: Icon(
                              Icons.auto_awesome,
                              size: 16,
                              color: scheme.secondary,
                            ),
                            label: const Text('Auto-generated'),
                          ),
                        ),
                      ?chip,
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _autoGenerated
                        ? 'These lyrics were auto-transcribed from your audio — '
                            'review and correct them, then save to replace the '
                            'auto-generated version.'
                        : 'Lyrics are auto-synced to your audio as closed captions. '
                            'Saving new text re-syncs them.',
                    style: TextStyle(color: surfaces.textSecondary, fontSize: 12),
                  ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        _error!,
                        style: TextStyle(color: scheme.error, fontSize: 12),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _controller,
                    enabled: !_saving,
                    minLines: 6,
                    maxLines: 14,
                    decoration: const InputDecoration(
                      hintText: 'Paste your lyrics, one line per lyric line.',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.lyrics_outlined),
                      label: const Text('Save lyrics'),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}


