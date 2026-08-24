import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../core/services/audio_player_service.dart';
import '../core/theme/networx_extensions.dart';

/// Nudge / scrub granularity in seconds.
const double kClipStep = 0.5;

/// Colors used to distinguish the start (green) and end (red) of the window.
const Color kClipStartColor = Color(0xFF22C55E); // green-500
const Color kClipEndColor = Color(0xFFEF4444); // red-500
const Color kClipPlayheadColor = Color(0xFF22D3EE); // cyan-400

/// Round to the nearest half-second.
double clipRoundHalf(num n) => (n * 2).round() / 2;

/// Format seconds as m:ss, appending .5 for half-second values.
String clipFmtTime(num totalSeconds) {
  final r = clipRoundHalf(totalSeconds < 0 ? 0 : totalSeconds);
  final m = (r ~/ 60);
  final rem = r - m * 60;
  final whole = rem.floor();
  final ss = whole.toString().padLeft(2, '0');
  return (rem - whole) >= 0.5 ? '$m:$ss.5' : '$m:$ss';
}

/// Format a duration in seconds, showing .5 when fractional (e.g. "12.5s").
String clipFmtLen(num seconds) {
  final r = clipRoundHalf(seconds < 0 ? 0 : seconds);
  return r == r.roundToDouble() ? '${r.toInt()}s' : '${r}s';
}

/// Parse "m:ss" or a plain seconds string into seconds. Null if invalid.
double? clipParseTime(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.contains(':')) {
    final parts = trimmed.split(':');
    if (parts.length != 2) return null;
    final m = int.tryParse(parts[0].trim());
    final s = double.tryParse(parts[1].trim());
    if (m == null || s == null || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  return double.tryParse(trimmed);
}

/// Generic window picker for trimming a clip from an audio source: start/end
/// time fields (green start, red end), ±0.5s nudge buttons, a start scrubber,
/// and a looping preview of just the selected window. Works with a remote
/// [audioUrl] or local [audioFilePath]. Used for the paid-preview sample
/// (5–30s) and the Discover swipe clip (5–15s), at upload and post-upload.
class ClipWindowSheet extends StatefulWidget {
  /// Remote audio URL to preview (signed full-track URL, etc.).
  final String? audioUrl;

  /// Local file path to preview (used during upload, before the file exists
  /// in storage). Takes precedence over [audioUrl] when set.
  final String? audioFilePath;

  final String displayTitle;
  final String heading;
  final String saveLabel;
  final String savedMessage;
  final int? durationSeconds;
  final int minLength;
  final int maxLength;
  final double initialStart;
  final double initialEnd;
  final Future<void> Function(double startSeconds, double endSeconds) onSave;

  /// When true, show a banner warning that saving overwrites the existing
  /// sample/clip (each song has exactly one of each).
  final bool alreadySet;

  /// Optional custom overwrite warning text shown when [alreadySet] is true.
  final String? overwriteWarning;

  const ClipWindowSheet({
    super.key,
    this.audioUrl,
    this.audioFilePath,
    required this.displayTitle,
    required this.heading,
    required this.saveLabel,
    required this.savedMessage,
    this.durationSeconds,
    required this.minLength,
    required this.maxLength,
    required this.initialStart,
    required this.initialEnd,
    required this.onSave,
    this.alreadySet = false,
    this.overwriteWarning,
  });

  @override
  State<ClipWindowSheet> createState() => _ClipWindowSheetState();
}

class _ClipWindowSheetState extends State<ClipWindowSheet> {
  final AudioPlayer _player = AudioPlayer();
  final TextEditingController _startCtrl = TextEditingController();
  final TextEditingController _endCtrl = TextEditingController();
  StreamSubscription<Duration>? _positionSub;
  StreamSubscription<PlayerState>? _playerStateSub;

  double _duration = 0;
  double _start = 0;
  double _end = 0;
  /// Absolute track position shown by the moving playhead.
  double _playhead = 0;
  bool _saving = false;
  /// Preview session is active (playing or paused mid-window).
  bool _previewActive = false;
  bool _isPlaying = false;
  bool _didSoftPauseRadio = false;
  bool _loopSeeking = false;

  int get _minLen => widget.minLength;
  int get _maxLen => widget.maxLength;

  /// Mute/pause live radio while the clip window preview plays.
  Future<void> _softPauseRadio() async {
    try {
      final handler = AudioPlayerService.handler;
      if (!handler.userPaused) {
        await handler.setUserPaused(true);
        _didSoftPauseRadio = true;
      }
      // Soft-mute keeps the stream advancing silently; hard-pause so the
      // separate preview player is the only audible source.
      await AudioPlayerService().player.pause();
    } catch (_) {}
  }

  Future<void> _softResumeRadioIfNeeded() async {
    if (!_didSoftPauseRadio) return;
    _didSoftPauseRadio = false;
    try {
      await AudioPlayerService.handler.setUserPaused(false);
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    _duration = (widget.durationSeconds ?? 0).toDouble();
    _start = clipRoundHalf(widget.initialStart);
    _end = widget.initialEnd > _start
        ? clipRoundHalf(widget.initialEnd)
        : _start + _maxLen;
    _playhead = _start;
    _syncText();
    _prepare();
    _positionSub = _player.positionStream.listen(_onPosition);
    _playerStateSub = _player.playerStateStream.listen((state) {
      if (!mounted || !_previewActive) return;
      final playing = state.playing;
      if (playing != _isPlaying) {
        setState(() => _isPlaying = playing);
      }
    });
  }

  void _onPosition(Duration pos) {
    if (!mounted || !_previewActive || _loopSeeking) return;
    final secs = pos.inMilliseconds / 1000.0;
    // Loop inside the selected window on the full track (no setClip).
    if (secs >= _end - 0.04) {
      unawaited(_seekToWindowStart());
      return;
    }
    if ((secs - _playhead).abs() >= 0.05) {
      setState(
        () => _playhead = secs.clamp(0, _duration > 0 ? _duration : secs),
      );
    }
  }

  Future<void> _seekToWindowStart() async {
    if (_loopSeeking) return;
    _loopSeeking = true;
    try {
      await _player.seek(Duration(milliseconds: (_start * 1000).round()));
      if (mounted) setState(() => _playhead = _start);
    } catch (_) {
    } finally {
      _loopSeeking = false;
    }
  }

  void _syncText() {
    _startCtrl.text = clipFmtTime(_start);
    _endCtrl.text = clipFmtTime(_end);
  }

  Future<void> _prepare() async {
    try {
      Duration? dur;
      final path = widget.audioFilePath;
      final url = widget.audioUrl;
      if (path != null && path.isNotEmpty) {
        dur = await _player.setFilePath(path);
      } else if (url != null && url.isNotEmpty) {
        dur = await _player.setUrl(url);
      } else {
        return;
      }
      if (!mounted) return;
      if (dur != null && dur.inMilliseconds > 0) {
        setState(() {
          if (_duration <= 0) {
            _duration = dur!.inMilliseconds / 1000.0;
          }
          _applyWindow(_start, _end, keepLength: true);
          _playhead = _start;
        });
      }
    } catch (_) {
      // Preview unavailable; saving still works.
    }
  }

  double get _maxStart {
    final d = _duration > 0 ? _duration : _maxLen.toDouble();
    final m = d - _minLen;
    return m < 0 ? 0.0 : m;
  }

  double get _windowLength {
    final l = _end - _start;
    return l.clamp(0, _maxLen.toDouble()).toDouble();
  }

  double get _timelineTotal {
    if (_duration > 0) return _duration;
    if (_end > 0) return _end;
    return _maxLen.toDouble();
  }

  /// Clamp the start/end pair so the window stays min–max and inside the track.
  void _applyWindow(double nextStart, double nextEnd, {bool keepLength = false}) {
    final dur = _duration;
    final upperStart = dur > 0 ? (dur - _minLen).clamp(0, dur).toDouble() : 1e9;
    var s = clipRoundHalf(nextStart).clamp(0, upperStart).toDouble();

    var e = clipRoundHalf(nextEnd);
    if (keepLength) {
      final length = (_end - _start).clamp(_minLen.toDouble(), _maxLen.toDouble());
      e = s + length;
    }
    if (e < s + _minLen) e = s + _minLen;
    if (e > s + _maxLen) e = s + _maxLen;
    if (dur > 0 && e > dur) {
      e = dur;
      if (e - s < _minLen) s = (e - _minLen).clamp(0, e).toDouble();
      if (e - s > _maxLen) s = e - _maxLen;
    }
    _start = s;
    _end = e;
    _syncText();
  }

  void _nudgeStart(double delta) {
    unawaited(_pausePreviewKeepSession());
    setState(() => _applyWindow(_start + delta, _end, keepLength: true));
  }

  void _nudgeEnd(double delta) {
    unawaited(_pausePreviewKeepSession());
    setState(() => _applyWindow(_start, _end + delta));
  }

  void _commitStartText() {
    final parsed = clipParseTime(_startCtrl.text);
    unawaited(_pausePreviewKeepSession());
    setState(() {
      if (parsed == null) {
        _syncText();
      } else {
        _applyWindow(parsed, _end, keepLength: true);
      }
    });
  }

  void _commitEndText() {
    final parsed = clipParseTime(_endCtrl.text);
    unawaited(_pausePreviewKeepSession());
    setState(() {
      if (parsed == null) {
        _syncText();
      } else {
        _applyWindow(_start, parsed);
      }
    });
  }

  Future<void> _pausePreviewKeepSession() async {
    if (!_previewActive) return;
    try {
      await _player.pause();
    } catch (_) {}
    if (mounted) setState(() => _isPlaying = false);
  }

  Future<void> _togglePreview() async {
    if (_isPlaying) {
      await _pausePreviewKeepSession();
      return;
    }
    if (_previewActive) {
      try {
        await _softPauseRadio();
        await _player.play();
        if (mounted) setState(() => _isPlaying = true);
      } catch (_) {}
      return;
    }
    await _startPreview();
  }

  Future<void> _startPreview() async {
    try {
      await _softPauseRadio();
      // Full-track playback so the playhead maps to absolute timestamps.
      await _player.setLoopMode(LoopMode.off);
      await _player.setClip();
      await _player.seek(Duration(milliseconds: (_start * 1000).round()));
      await _player.play();
      if (!mounted) return;
      setState(() {
        _previewActive = true;
        _isPlaying = true;
        _playhead = _start;
      });
    } catch (_) {
      await _softResumeRadioIfNeeded();
      if (mounted) {
        setState(() {
          _previewActive = false;
          _isPlaying = false;
        });
      }
    }
  }

  Future<void> _stopPreview() async {
    try {
      await _player.pause();
      await _player.setLoopMode(LoopMode.off);
      await _player.setClip();
    } catch (_) {}
    await _softResumeRadioIfNeeded();
    if (mounted) {
      setState(() {
        _previewActive = false;
        _isPlaying = false;
        _playhead = _start;
      });
    }
  }

  void _setStartFromPlayhead() {
    unawaited(_pausePreviewKeepSession());
    setState(() {
      _applyWindow(_playhead, _end, keepLength: true);
      _playhead = _start;
    });
  }

  void _setEndFromPlayhead() {
    unawaited(_pausePreviewKeepSession());
    setState(() {
      _applyWindow(_start, _playhead);
      _playhead = _playhead.clamp(_start, _end);
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _stopPreview();
      await widget.onSave(_start, _end);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(widget.savedMessage)),
      );
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not save: $e')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _positionSub?.cancel();
    _playerStateSub?.cancel();
    _startCtrl.dispose();
    _endCtrl.dispose();
    // Best-effort: stop preview and unmute radio if this sheet paused it.
    try {
      _player.pause();
    } catch (_) {}
    if (_didSoftPauseRadio) {
      _didSoftPauseRadio = false;
      try {
        AudioPlayerService.handler.setUserPaused(false);
      } catch (_) {}
    }
    _player.dispose();
    super.dispose();
  }

  Widget _timeField({
    required TextEditingController controller,
    required String label,
    required Color color,
    required VoidCallback onCommit,
    required VoidCallback onMinus,
    required VoidCallback onPlus,
    String? minusTooltip,
    String? plusTooltip,
  }) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: controller,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            style: TextStyle(color: color, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              labelText: label,
              labelStyle: TextStyle(color: color),
              isDense: true,
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: color.withValues(alpha: 0.6)),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: color, width: 2),
              ),
            ),
            onEditingComplete: onCommit,
            onSubmitted: (_) => onCommit(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.outlined(
          tooltip: minusTooltip,
          onPressed: onMinus,
          style: IconButton.styleFrom(
            foregroundColor: color,
            side: BorderSide(color: color.withValues(alpha: 0.6)),
          ),
          icon: const Icon(Icons.remove),
        ),
        IconButton.outlined(
          tooltip: plusTooltip,
          onPressed: onPlus,
          style: IconButton.styleFrom(
            foregroundColor: color,
            side: BorderSide(color: color.withValues(alpha: 0.6)),
          ),
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }

  Widget _buildTimeline(Color muted) {
    final total = _timelineTotal <= 0 ? 1.0 : _timelineTotal;
    final startFrac = (_start / total).clamp(0.0, 1.0);
    final endFrac = (_end / total).clamp(0.0, 1.0);
    final playFrac = (_playhead / total).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              'Now ${clipFmtTime(_playhead)}',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: _previewActive ? kClipPlayheadColor : muted,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            const Spacer(),
            Text(
              '/ ${clipFmtTime(total)}',
              style: TextStyle(color: muted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 36,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final w = constraints.maxWidth;
              final windowLeft = startFrac * w;
              final windowWidth = ((endFrac - startFrac) * w).clamp(2.0, w);
              final playX = playFrac * w;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: muted.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  Positioned(
                    left: windowLeft,
                    width: windowWidth,
                    top: 0,
                    bottom: 0,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: kClipStartColor.withValues(alpha: 0.28),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  // Start edge
                  Positioned(
                    left: windowLeft - 1,
                    top: 0,
                    bottom: 0,
                    child: Container(width: 2, color: kClipStartColor),
                  ),
                  // End edge
                  Positioned(
                    left: (windowLeft + windowWidth - 1).clamp(0.0, w - 2),
                    top: 0,
                    bottom: 0,
                    child: Container(width: 2, color: kClipEndColor),
                  ),
                  // Moving playhead
                  Positioned(
                    left: (playX - 7).clamp(0.0, w - 14),
                    top: 4,
                    child: Container(
                      width: 14,
                      height: 28,
                      alignment: Alignment.center,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: kClipPlayheadColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.35),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final previewLabel = !_previewActive
        ? 'Preview ${clipFmtLen(_windowLength)}'
        : (_isPlaying ? 'Pause' : 'Resume');
    final previewIcon = !_previewActive
        ? Icons.play_arrow
        : (_isPlaying ? Icons.pause : Icons.play_arrow);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          8,
          16,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.heading,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                widget.displayTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: surfaces.textSecondary),
              ),
              if (widget.alreadySet) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border:
                        Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline,
                          size: 16, color: Colors.amber),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          widget.overwriteWarning ??
                              'Already set (${clipFmtTime(widget.initialStart)} – ${clipFmtTime(widget.initialEnd)}). Saving overwrites it.',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.amber,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              _timeField(
                controller: _startCtrl,
                label: 'Start (m:ss)',
                color: kClipStartColor,
                onCommit: _commitStartText,
                onMinus: () => _nudgeStart(-kClipStep),
                onPlus: () => _nudgeStart(kClipStep),
                minusTooltip: 'Nudge start back 0.5s',
                plusTooltip: 'Nudge start forward 0.5s',
              ),
              const SizedBox(height: 12),
              _timeField(
                controller: _endCtrl,
                label: 'End (m:ss) — $_minLen to ${_maxLen}s window',
                color: kClipEndColor,
                onCommit: _commitEndText,
                onMinus: () => _nudgeEnd(-kClipStep),
                onPlus: () => _nudgeEnd(kClipStep),
                minusTooltip: 'Nudge end back 0.5s',
                plusTooltip: 'Nudge end forward 0.5s',
              ),
              const SizedBox(height: 16),
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(text: 'Window: '),
                    TextSpan(
                      text: clipFmtTime(_start),
                      style: const TextStyle(
                        color: kClipStartColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const TextSpan(text: ' – '),
                    TextSpan(
                      text: clipFmtTime(_end),
                      style: const TextStyle(
                        color: kClipEndColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    TextSpan(text: '  ·  ${clipFmtLen(_windowLength)}'),
                  ],
                ),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              _buildTimeline(surfaces.textMuted),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: kClipStartColor,
                  thumbColor: kClipStartColor,
                ),
                child: Slider(
                  value: _start.clamp(0, _maxStart).toDouble(),
                  min: 0,
                  max: _maxStart <= 0 ? 1.0 : _maxStart,
                  divisions:
                      _maxStart > 0 ? (_maxStart / kClipStep).round() : null,
                  label: clipFmtTime(_start),
                  onChanged: _maxStart <= 0
                      ? null
                      : (v) {
                          unawaited(_pausePreviewKeepSession());
                          setState(
                              () => _applyWindow(v, _end, keepLength: true));
                        },
                ),
              ),
              Text(
                _duration > 0
                    ? 'Track length: ${clipFmtTime(_duration)} · drag green to move the window'
                    : 'Choose where the clip starts and how long it runs.',
                style: TextStyle(color: surfaces.textMuted, fontSize: 12),
              ),
              if (_previewActive) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    TextButton.icon(
                      onPressed: _setStartFromPlayhead,
                      icon: const Icon(Icons.flag, size: 16),
                      label: Text('Start @ ${clipFmtTime(_playhead)}'),
                    ),
                    TextButton.icon(
                      onPressed: _setEndFromPlayhead,
                      icon: const Icon(Icons.flag_outlined, size: 16),
                      label: Text('End @ ${clipFmtTime(_playhead)}'),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _togglePreview,
                    icon: Icon(previewIcon),
                    label: Text(previewLabel),
                  ),
                  if (_previewActive) ...[
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: _stopPreview,
                      child: const Text('Stop'),
                    ),
                  ],
                  const Spacer(),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(widget.saveLabel),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
