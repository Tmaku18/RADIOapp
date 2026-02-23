import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../core/services/refinery_service.dart';
import '../../core/services/radio_service.dart';

class RefineryScreen extends StatefulWidget {
  const RefineryScreen({super.key});

  @override
  State<RefineryScreen> createState() => _RefineryScreenState();
}

class _RefineryScreenState extends State<RefineryScreen> {
  final RefineryService _refinery = RefineryService();
  final RadioService _radio = RadioService();

  bool _loading = true;
  String? _error;
  List<RefinerySong> _songs = [];
  final Map<String, List<RefineryComment>> _comments = {};
  final Map<String, String> _newComment = {};
  final Map<String, int> _rank = {};
  final Map<String, Map<String, dynamic>> _survey = {};
  String? _playingId;
  final AudioPlayer _player = AudioPlayer();
  final Map<String, String> _submitting = {};

  @override
  void initState() {
    super.initState();
    _load();
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        if (mounted) setState(() => _playingId = null);
      }
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final songs = await _refinery.listSongs();
      if (mounted) setState(() => _songs = songs);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadComments(String songId) async {
    try {
      final list = await _refinery.getComments(songId);
      if (mounted) setState(() => _comments[songId] = list);
    } catch (_) {}
  }

  Future<void> _play(RefinerySong song) async {
    if (_playingId == song.id) {
      await _player.stop();
      setState(() => _playingId = null);
      return;
    }
    setState(() => _playingId = song.id);
    await _player.setUrl(song.audioUrl);
    await _player.play();
  }

  Future<void> _submitRank(String songId) async {
    final score = _rank[songId];
    if (score == null || score < 1 || score > 10) return;
    setState(() => _submitting[songId] = 'rank');
    try {
      await _radio.submitRefinement(songId: songId, score: score);
    } catch (_) {}
    if (mounted) setState(() => _submitting.remove(songId));
  }

  Future<void> _submitSurvey(String songId) async {
    final s = _survey[songId];
    if (s == null || s.isEmpty) return;
    setState(() => _submitting[songId] = 'survey');
    try {
      await _radio.submitSurvey(songId: songId, responses: s);
    } catch (_) {}
    if (mounted) setState(() => _submitting.remove(songId));
  }

  Future<void> _submitComment(String songId) async {
    final body = (_newComment[songId] ?? '').trim();
    if (body.isEmpty) return;
    setState(() => _submitting[songId] = 'comment');
    try {
      await _refinery.addComment(songId, body);
      _newComment[songId] = '';
      await _loadComments(songId);
    } catch (_) {}
    if (mounted) setState(() => _submitting.remove(songId));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('The Refinery'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
                        const SizedBox(height: 16),
                        FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _songs.isEmpty
                  ? Center(
                      child: Text(
                        'No ores in The Refinery right now.',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _songs.length,
                        itemBuilder: (context, i) {
                          final song = _songs[i];
                          return _RefinerySongCard(
                            song: song,
                            isPlaying: _playingId == song.id,
                            rank: _rank[song.id] ?? 5,
                            onRankChanged: (v) => setState(() => _rank[song.id] = v),
                            onRankSubmit: () => _submitRank(song.id),
                            survey: _survey[song.id] ?? {},
                            onSurveyChanged: (k, v) => setState(() {
                              _survey[song.id] = {...?_survey[song.id], k: v};
                            }),
                            onSurveySubmit: () => _submitSurvey(song.id),
                            comments: _comments[song.id],
                            newComment: _newComment[song.id] ?? '',
                            onNewCommentChanged: (v) => setState(() => _newComment[song.id] = v),
                            onCommentSubmit: () => _submitComment(song.id),
                            onLoadComments: () => _loadComments(song.id),
                            submitting: _submitting[song.id],
                            onPlay: () => _play(song),
                          );
                        },
                      ),
                    ),
    );
  }
}

class _RefinerySongCard extends StatelessWidget {
  final RefinerySong song;
  final bool isPlaying;
  final int rank;
  final ValueChanged<int> onRankChanged;
  final VoidCallback onRankSubmit;
  final Map<String, dynamic> survey;
  final void Function(String key, dynamic value) onSurveyChanged;
  final VoidCallback onSurveySubmit;
  final List<RefineryComment>? comments;
  final String newComment;
  final ValueChanged<String> onNewCommentChanged;
  final VoidCallback onCommentSubmit;
  final VoidCallback onLoadComments;
  final String? submitting;
  final VoidCallback onPlay;

  const _RefinerySongCard({
    required this.song,
    required this.isPlaying,
    required this.rank,
    required this.onRankChanged,
    required this.onRankSubmit,
    required this.survey,
    required this.onSurveyChanged,
    required this.onSurveySubmit,
    required this.comments,
    required this.newComment,
    required this.onNewCommentChanged,
    required this.onCommentSubmit,
    required this.onLoadComments,
    required this.submitting,
    required this.onPlay,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (song.artworkUrl != null && song.artworkUrl!.isNotEmpty)
                  Image.network(song.artworkUrl!, width: 56, height: 56, fit: BoxFit.cover)
                else
                  const SizedBox(width: 56, height: 56, child: Icon(Icons.music_note, size: 32)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(song.title, style: theme.textTheme.titleMedium),
                      Text(song.artistName, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                IconButton.filled(
                  onPressed: onPlay,
                  icon: Icon(isPlaying ? Icons.stop : Icons.play_arrow),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Text('Rank 1–10:', style: theme.textTheme.labelMedium),
                const SizedBox(width: 8),
                DropdownButton<int>(
                  value: rank.clamp(1, 10),
                  items: List.generate(10, (i) => i + 1).map((v) => DropdownMenuItem(value: v, child: Text('$v'))).toList(),
                  onChanged: (v) => v != null ? onRankChanged(v) : null,
                ),
                const SizedBox(width: 8),
                FilledButton.tonal(
                  onPressed: submitting == 'rank' ? null : onRankSubmit,
                  child: Text(submitting == 'rank' ? '…' : 'Submit'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('Survey (optional)', style: theme.textTheme.labelSmall),
            const SizedBox(height: 4),
            TextField(
              decoration: const InputDecoration(labelText: 'Genre', isDense: true),
              onChanged: (v) => onSurveyChanged('genre', v),
            ),
            const SizedBox(height: 4),
            TextField(
              decoration: const InputDecoration(labelText: 'Mood', isDense: true),
              onChanged: (v) => onSurveyChanged('mood', v),
            ),
            const SizedBox(height: 4),
            FilledButton.tonal(
              onPressed: submitting == 'survey' ? null : onSurveySubmit,
              child: Text(submitting == 'survey' ? 'Submitting…' : 'Submit survey'),
            ),
            const SizedBox(height: 12),
            Text('Comments', style: theme.textTheme.labelMedium),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    decoration: const InputDecoration(hintText: 'Leave a comment…', isDense: true),
                    onChanged: onNewCommentChanged,
                    onSubmitted: (_) => onCommentSubmit(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.tonal(
                  onPressed: submitting == 'comment' ? null : onCommentSubmit,
                  child: Text(submitting == 'comment' ? '…' : 'Post'),
                ),
              ],
            ),
            if (comments != null)
              ...comments!.map((c) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('${c.displayName ?? 'Prospector'}: ${c.body}', style: theme.textTheme.bodySmall),
                  ))
            else
              TextButton(
                onPressed: onLoadComments,
                child: const Text('Load comments'),
              ),
          ],
        ),
      ),
    );
  }
}
