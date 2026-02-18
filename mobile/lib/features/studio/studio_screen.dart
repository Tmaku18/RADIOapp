import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/song.dart';
import '../../core/services/songs_service.dart';
import '../../core/theme/networx_extensions.dart';
import '../credits/credits_screen.dart';
import '../upload/upload_screen.dart';
import 'buy_plays_screen.dart';

class StudioScreen extends StatefulWidget {
  const StudioScreen({super.key});

  @override
  State<StudioScreen> createState() => _StudioScreenState();
}

class _StudioScreenState extends State<StudioScreen> {
  final SongsService _songs = SongsService();
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

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Studio'),
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
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Buy plays for each approved song. \$1/min per play, rounded up to the nearest cent. Tap a track to buy plays.',
                            style: TextStyle(
                              color: surfaces.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        FilledButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const UploadScreen()),
                            ).then((_) => _load());
                          },
                          icon: const Icon(Icons.upload),
                          label: const Text('Upload'),
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
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const CreditsScreen()),
                        ).then((_) => _load());
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
                        'No uploads yet. Add your first track to the rotation.',
                        style: TextStyle(color: surfaces.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else
                  ..._items.map((s) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Card(
                          child: ListTile(
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
                                  const SizedBox(width: 8),
                                  FilledButton(
                                    onPressed: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              BuyPlaysScreen(song: s),
                                        ),
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
                        ),
                      )),
              ],
            ),
    );
  }
}


