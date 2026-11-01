import 'dart:async';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/services/audio_player_service.dart';
import '../../core/services/growth_service.dart';
import '../../widgets/shared/media_widgets.dart';
import '../../widgets/states/app_states.dart';

class ListeningToolsScreen extends StatefulWidget {
  const ListeningToolsScreen({super.key});

  @override
  State<ListeningToolsScreen> createState() => _ListeningToolsScreenState();
}

class _ListeningToolsScreenState extends State<ListeningToolsScreen> {
  final _growth = GrowthService();
  List<Map<String, dynamic>> _history = const [];
  List<Map<String, dynamic>> _favorites = const [];
  bool _loading = true;
  int? _sleepMinutes;
  Timer? _sleepTimer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _sleepTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final cached = await _growth.cachedFavorites();
    if (mounted) setState(() => _favorites = cached);
    try {
      final results = await Future.wait([
        _growth.history(),
        _growth.refreshFavorites(),
      ]);
      if (!mounted) return;
      setState(() {
        _history = results[0];
        _favorites = results[1];
      });
    } catch (_) {
      if (!mounted) return;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _setSleep(int? minutes) {
    _sleepTimer?.cancel();
    setState(() => _sleepMinutes = minutes);
    if (minutes == null) return;
    _sleepTimer = Timer(Duration(minutes: minutes), () async {
      await AudioPlayerService.handler.setUserPaused(true);
      if (mounted) setState(() => _sleepMinutes = null);
    });
  }

  Future<void> _shareNowPlaying() async {
    final item = _history.isNotEmpty ? _history.first : null;
    final title = item?['title']?.toString() ?? 'NetworX Radio';
    final artist = item?['artistName']?.toString() ?? '';
    final songId = item?['songId']?.toString();
    final link = songId == null || songId.isEmpty
        ? 'https://www.networxradio.com'
        : 'https://www.networxradio.com/song/$songId';
    await Share.share('$title${artist.isEmpty ? '' : ' — $artist'}\n$link');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Listening')),
      body: _loading
          ? const SkeletonList()
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('Sleep timer', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final minutes in [15, 30, 45, 60])
                        ChoiceChip(
                          label: Text('$minutes min'),
                          selected: _sleepMinutes == minutes,
                          onSelected: (on) => _setSleep(on ? minutes : null),
                        ),
                      if (_sleepMinutes != null)
                        ActionChip(
                          label: const Text('Cancel'),
                          onPressed: () => _setSleep(null),
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: _shareNowPlaying,
                    icon: const Icon(Icons.ios_share),
                    label: const Text('Share what you heard'),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Android Auto lists every station. The home-screen widget and the lock screen follow the song that is on. A shared link opens that song or artist in the app. CarPlay uses the same lock-screen controls; the CarPlay app icon needs Apple to enable CarPlay Audio for this app.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 20),
                  Text('Saved on this phone', style: Theme.of(context).textTheme.titleMedium),
                  if (_favorites.isEmpty)
                    const EmptyState(
                      title: 'No favorites yet',
                      message: 'Star a song on the radio and it will stay here offline.',
                      illustrationAsset: 'assets/images/illustrations/empty-songs.jpg',
                    )
                  else
                    ..._favorites.map(
                      (song) => SongTile(
                        title: '${song['title'] ?? ''}',
                        artist: '${song['artistName'] ?? ''}',
                        artworkUrl: song['artworkUrl'] as String?,
                      ),
                    ),
                  const SizedBox(height: 12),
                  Text('Recent listening', style: Theme.of(context).textTheme.titleMedium),
                  if (_history.isEmpty)
                    const EmptyState(
                      title: 'Nothing played yet',
                      message: 'Songs you hear on the radio show up here.',
                    )
                  else
                    ..._history.map(
                      (row) => ListTile(
                        leading: SizedBox(
                          width: 48,
                          height: 48,
                          child: ArtworkImage(url: row['artworkUrl'] as String?),
                        ),
                        title: Text('${row['title'] ?? ''}'),
                        subtitle: Text('${row['artistName'] ?? ''}'),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
