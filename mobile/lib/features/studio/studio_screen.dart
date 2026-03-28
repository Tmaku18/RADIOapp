import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/models/song.dart';
import '../../core/services/refinery_service.dart';
import '../../core/services/songs_service.dart';
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Buy plays for each approved song. Flat \$1.99 per play. Tap a track to buy plays.',
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
                              label: const Text('Upload'),
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
                                      const SizedBox(width: 8),
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
                                      TextButton.icon(
                                        onPressed: () => _showLikesSheet(s),
                                        icon: const Icon(Icons.favorite_border),
                                        label: const Text('View likes'),
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


