import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';

import '../../../core/services/song_stories_service.dart';

const _prefKey = 'networx_song_stories_on';

/// Public clips of the song that is playing. Listeners can hide the row.
class SongStoriesStrip extends StatefulWidget {
  const SongStoriesStrip({
    super.key,
    required this.songId,
    this.compact = false,
  });

  final String? songId;
  final bool compact;

  static Future<void> open(BuildContext context, String songId) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _SongStoryBrowser(songId: songId),
      ),
    );
  }

  @override
  State<SongStoriesStrip> createState() => _SongStoriesStripState();
}

class _SongStoriesStripState extends State<SongStoriesStrip> {
  final SongStoriesService _stories = SongStoriesService();
  bool _enabled = true;
  List<SongStory> _items = const [];

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void didUpdateWidget(SongStoriesStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.songId != widget.songId) _load();
  }

  Future<void> _boot() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() => _enabled = prefs.getBool(_prefKey) ?? true);
    if (_enabled) await _load();
  }

  Future<void> _load() async {
    final songId = widget.songId;
    if (!SongStoriesService.isSongId(songId)) {
      if (mounted) setState(() => _items = const []);
      return;
    }
    try {
      final items = await _stories.list(songId!);
      if (!mounted) return;
      setState(() => _items = items);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items = const []);
    }
  }

  Future<void> _toggle() async {
    final next = !_enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKey, next);
    if (!mounted) return;
    setState(() => _enabled = next);
    if (next) await _load();
  }

  void _open(int index) {
    final songId = widget.songId;
    if (songId == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _SongStoryBrowser(songId: songId, initialIndex: index),
      ),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    if (!SongStoriesService.isSongId(widget.songId)) {
      return const SizedBox.shrink();
    }
    if (widget.compact) {
      if (!_enabled || _items.isEmpty) return const SizedBox.shrink();
      return _avatars();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextButton(
          onPressed: _toggle,
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: const Size(0, 32),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(_enabled ? 'Hide song stories' : 'Show song stories'),
        ),
        if (_enabled && _items.isNotEmpty) _avatars(),
        if (_enabled && _items.isEmpty)
          Text(
            'No stories for this song yet. Public stories stay up for 24 hours.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
      ],
    );
  }

  Widget _avatars() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final story = _items[index];
          return InkWell(
            onTap: () => _open(index),
            customBorder: const CircleBorder(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: story.isPublic ? const Color(0xFF67E8F9) : Colors.white24,
                  width: 2,
                ),
              ),
              child: CircleAvatar(
                backgroundImage: story.avatarUrl != null && story.avatarUrl!.isNotEmpty
                    ? NetworkImage(story.avatarUrl!)
                    : null,
                child: story.avatarUrl == null || story.avatarUrl!.isEmpty
                    ? Text(story.authorName.isEmpty ? '?' : story.authorName[0].toUpperCase())
                    : null,
              ),
            ),
          );
        },
      ),
    );
  }
}

class _SongStoryBrowser extends StatefulWidget {
  const _SongStoryBrowser({required this.songId, this.initialIndex = 0});

  final String songId;
  final int initialIndex;

  @override
  State<_SongStoryBrowser> createState() => _SongStoryBrowserState();
}

class _SongStoryBrowserState extends State<_SongStoryBrowser> {
  final SongStoriesService _stories = SongStoriesService();
  List<SongStory> _items = const [];
  int _index = 0;
  bool _loading = true;
  String? _error;
  VideoPlayerController? _player;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await _stories.list(widget.songId);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
        if (_index >= items.length) _index = 0;
      });
      if (items.isNotEmpty) await _play(items[_index]);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load stories.';
      });
    }
  }

  Future<void> _play(SongStory story) async {
    final previous = _player;
    _player = null;
    await previous?.dispose();
    final controller = VideoPlayerController.networkUrl(Uri.parse(story.mediaUrl));
    _player = controller;
    try {
      await controller.initialize();
      await controller.play();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not play this story.');
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  Future<void> _shift(int delta) async {
    final next = _index + delta;
    if (next < 0 || next >= _items.length) return;
    setState(() => _index = next);
    await _play(_items[next]);
  }

  Future<void> _toggleVisibility() async {
    final story = _items[_index];
    try {
      await _stories.setVisibility(story.id, !story.isPublic);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not update this story.');
    }
  }

  Future<void> _delete() async {
    final story = _items[_index];
    try {
      await _stories.remove(story.id);
      await _load();
      if (_items.isEmpty && mounted) Navigator.of(context).pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not delete this story.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final story = _items.isEmpty ? null : _items[_index];
    final player = _player;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(story?.authorName ?? 'Song stories'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : story == null
              ? Center(
                  child: Text(
                    _error ?? 'No stories for this song yet.',
                    style: const TextStyle(color: Colors.white),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: player != null && player.value.isInitialized
                            ? AspectRatio(
                                aspectRatio: player.value.aspectRatio == 0
                                    ? 9 / 16
                                    : player.value.aspectRatio,
                                child: VideoPlayer(player),
                              )
                            : const CircularProgressIndicator(),
                      ),
                    ),
                    if (story.caption != null && story.caption!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: Text(
                          story.caption!,
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                    if (story.visibility == 'private')
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text('Private', style: TextStyle(color: Colors.white70)),
                      ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                      ),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Wrap(
                        spacing: 8,
                        children: [
                          if (_index > 0)
                            OutlinedButton(
                              onPressed: () => _shift(-1),
                              child: const Text('Previous'),
                            ),
                          if (_index < _items.length - 1)
                            OutlinedButton(
                              onPressed: () => _shift(1),
                              child: const Text('Next'),
                            ),
                          if (story.mine)
                            OutlinedButton(
                              onPressed: _toggleVisibility,
                              child: Text(story.isPublic ? 'Make private' : 'Make public'),
                            ),
                          if (story.mine)
                            OutlinedButton(
                              onPressed: _delete,
                              child: const Text('Delete'),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}
