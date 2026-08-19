import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/constants/refinery_questions.dart';
import '../../core/services/api_service.dart';
import '../../core/services/refinery_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Full review form after a reviewer picks a song — same questions as web.
class RefineryReviewScreen extends StatefulWidget {
  const RefineryReviewScreen({super.key, required this.songId});

  final String songId;

  @override
  State<RefineryReviewScreen> createState() => _RefineryReviewScreenState();
}

class _RefineryReviewScreenState extends State<RefineryReviewScreen> {
  final RefineryService _service = RefineryService();
  final AudioPlayer _player = AudioPlayer();
  final TextEditingController _comment = TextEditingController();
  final Map<String, TextEditingController> _customControllers = {};

  RefineryReviewForm? _form;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  bool _playing = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  Duration? _scrub;
  final Map<String, int> _ratings = {
    for (final q in kRefineryRatingQuestions) q.key: 5,
  };
  final Map<String, String> _survey = {};

  @override
  void initState() {
    super.initState();
    _player.positionStream.listen((p) {
      if (!mounted || _scrub != null) return;
      setState(() => _position = p);
    });
    _player.durationStream.listen((d) {
      if (!mounted || d == null) return;
      setState(() => _duration = d);
    });
    _player.playerStateStream.listen((s) {
      if (!mounted) return;
      setState(() {
        _playing = s.playing;
        if (s.processingState == ProcessingState.completed) {
          _playing = false;
          _position = _duration;
        }
      });
    });
    _load();
  }

  @override
  void dispose() {
    _player.dispose();
    _comment.dispose();
    for (final c in _customControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final form = await _service.getReviewForm(widget.songId);
      for (final q in form.customQuestions) {
        _customControllers[q.id] = TextEditingController();
      }
      if (!mounted) return;
      setState(() => _form = form);
      if (form.song.audioUrl.isNotEmpty) {
        await _player.setUrl(form.song.audioUrl);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _friendlyError(Object e) {
    if (e is ApiException && e.message.trim().isNotEmpty) return e.message;
    final s = e.toString();
    if (s.contains('already reviewed')) {
      return 'You have already reviewed this song.';
    }
    return s.replaceFirst(RegExp(r'^Exception:\s*'), '');
  }

  bool get _surveyComplete =>
      kRefinerySurveyQuestions.every((q) => (_survey[q.key] ?? '').isNotEmpty);

  bool get _customComplete {
    final form = _form;
    if (form == null) return false;
    return form.customQuestions.every(
      (q) => (_customControllers[q.id]?.text.trim() ?? '').isNotEmpty,
    );
  }

  bool get _canSubmit =>
      !_submitting && _form != null && _surveyComplete && _customComplete;

  Future<void> _togglePlay() async {
    if (_form == null || _form!.song.audioUrl.isEmpty) return;
    if (_playing) {
      await _player.pause();
    } else {
      if (_duration > Duration.zero && _position >= _duration) {
        await _player.seek(Duration.zero);
      }
      await _player.play();
    }
  }

  Future<void> _seek(Duration to) async {
    await _player.seek(to);
    if (mounted) {
      setState(() {
        _scrub = null;
        _position = to;
      });
    }
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final custom = <String, String>{
        for (final e in _customControllers.entries)
          if (e.value.text.trim().isNotEmpty) e.key: e.value.text.trim(),
      };
      await _service.submitReview(
        songId: widget.songId,
        overallRating: _ratings['overall_rating'] ?? 5,
        beatRating: _ratings['beat_rating'] ?? 5,
        lyricsRating: _ratings['lyrics_rating'] ?? 5,
        chorusRating: _ratings['chorus_rating'] ?? 5,
        openingEndingRating: _ratings['opening_ending_rating'] ?? 5,
        surveyResponses: Map<String, String>.from(_survey),
        customResponses: custom,
        comment: _comment.text.trim(),
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _friendlyError(e);
        _submitting = false;
      });
    }
  }

  String _fmt(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final h = d.inHours;
    if (h > 0) return '$h:$m:$s';
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final form = _form;
    return DimensionScreenShell(
      title: 'Review song',
      showNeonLine: true,
      loading: _loading,
      body: form == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error ?? 'Could not load this review.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Back'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Listen to the full song, then complete every section. '
                  'You’ll earn \$${(form.reviewRewardCents / 100).toStringAsFixed(2)} '
                  'when you submit.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ],
                const SizedBox(height: 16),
                _playerCard(theme, form),
                const SizedBox(height: 20),
                Text('Rate each aspect (1–10)', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                ...kRefineryRatingQuestions.map(_ratingRow),
                const SizedBox(height: 20),
                Text('Survey questions', style: theme.textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  'Every question is required.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                ...kRefinerySurveyQuestions.map(_surveyRow),
                if (form.customQuestions.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(
                    "The artist's questions",
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  ...form.customQuestions.map(_customRow),
                ],
                const SizedBox(height: 20),
                Text('Comment (optional)', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                TextField(
                  controller: _comment,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 2000,
                  decoration: const InputDecoration(
                    hintText: 'Anything else you want to share with the artist?',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _canSubmit ? _submit : null,
                  child: Text(
                    _submitting
                        ? 'Submitting…'
                        : 'Submit review (+\$${(form.reviewRewardCents / 100).toStringAsFixed(2)})',
                  ),
                ),
                if (!_surveyComplete || !_customComplete)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Answer every required question to submit.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _playerCard(ThemeData theme, RefineryReviewForm form) {
    final live = _scrub ?? _position;
    final maxMs = _duration.inMilliseconds.toDouble();
    final valueMs = live.inMilliseconds.toDouble().clamp(
      0.0,
      maxMs <= 0 ? 0.0 : maxMs,
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                if ((form.song.artworkUrl ?? '').isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      form.song.artworkUrl!,
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                    ),
                  )
                else
                  const SizedBox(
                    width: 56,
                    height: 56,
                    child: Icon(Icons.music_note, size: 32),
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(form.song.title, style: theme.textTheme.titleMedium),
                      Text(
                        form.song.artistName,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton.filled(
                  onPressed: _togglePlay,
                  icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
                ),
              ],
            ),
            Slider(
              min: 0,
              max: maxMs <= 0 ? 1 : maxMs,
              value: maxMs <= 0 ? 0 : valueMs,
              onChanged: maxMs <= 0
                  ? null
                  : (v) => setState(
                        () => _scrub = Duration(milliseconds: v.round()),
                      ),
              onChangeEnd: maxMs <= 0
                  ? null
                  : (v) => _seek(Duration(milliseconds: v.round())),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(_fmt(live), style: theme.textTheme.labelSmall),
                Text(_fmt(_duration), style: theme.textTheme.labelSmall),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _ratingRow(RefineryRatingQuestion q) {
    final value = (_ratings[q.key] ?? 5).clamp(1, 10);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(q.question)),
              Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          Slider(
            min: 1,
            max: 10,
            divisions: 9,
            value: value.toDouble(),
            label: '$value',
            onChanged: (v) => setState(() => _ratings[q.key] = v.round()),
          ),
        ],
      ),
    );
  }

  Widget _surveyRow(RefinerySurveyQuestion q) {
    final selected = _survey[q.key];
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q.question),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: q.options.map((opt) {
              final on = selected == opt;
              return ChoiceChip(
                label: Text(opt),
                selected: on,
                onSelected: (_) => setState(() => _survey[q.key] = opt),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _customRow(RefineryCustomQuestion q) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _customControllers[q.id],
        minLines: 2,
        maxLines: 4,
        maxLength: 1000,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(
          labelText: q.questionText,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
