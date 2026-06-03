import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../core/theme/networx_extensions.dart';

/// Nudge / scrub granularity in seconds.
const double kClipStep = 0.5;

/// Colors used to distinguish the start (green) and end (red) of the window.
const Color kClipStartColor = Color(0xFF22C55E); // green-500
const Color kClipEndColor = Color(0xFFEF4444); // red-500

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
  double _duration = 0;
  double _start = 0;
  double _end = 0;
  bool _saving = false;
  bool _previewing = false;

  int get _minLen => widget.minLength;
  int get _maxLen => widget.maxLength;

  @override
  void initState() {
    super.initState();
    _duration = (widget.durationSeconds ?? 0).toDouble();
    _start = clipRoundHalf(widget.initialStart);
    _end = widget.initialEnd > _start
        ? clipRoundHalf(widget.initialEnd)
        : _start + _maxLen;
    _syncText();
    _prepare();
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
      if (dur != null && dur.inSeconds > 0) {
        setState(() {
          if (_duration <= 0) _duration = dur!.inSeconds.toDouble();
          _applyWindow(_start, _end, keepLength: true);
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
    _stopPreview();
    setState(() => _applyWindow(_start + delta, _end, keepLength: true));
  }

  void _nudgeEnd(double delta) {
    _stopPreview();
    setState(() => _applyWindow(_start, _end + delta));
  }

  void _commitStartText() {
    final parsed = clipParseTime(_startCtrl.text);
    _stopPreview();
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
    _stopPreview();
    setState(() {
      if (parsed == null) {
        _syncText();
      } else {
        _applyWindow(_start, parsed);
      }
    });
  }

  Future<void> _preview() async {
    try {
      // Clip + loop-one plays only the selected window, repeating it.
      await _player.setClip(
        start: Duration(milliseconds: (_start * 1000).round()),
        end: Duration(milliseconds: (_end * 1000).round()),
      );
      await _player.setLoopMode(LoopMode.one);
      await _player.play();
      if (!mounted) return;
      setState(() => _previewing = true);
    } catch (_) {
      if (mounted) setState(() => _previewing = false);
    }
  }

  Future<void> _stopPreview() async {
    try {
      await _player.pause();
      await _player.setLoopMode(LoopMode.off);
      await _player.setClip();
    } catch (_) {}
    if (mounted) setState(() => _previewing = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
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
    _startCtrl.dispose();
    _endCtrl.dispose();
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
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
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
            // Start time (green) with -0.5s / +0.5s nudge buttons.
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
            // End time (red) with -0.5s / +0.5s nudge buttons.
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
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: kClipStartColor,
                thumbColor: kClipStartColor,
              ),
              child: Slider(
                value: _start.clamp(0, _maxStart).toDouble(),
                min: 0,
                max: _maxStart <= 0 ? 1.0 : _maxStart,
                divisions: _maxStart > 0 ? (_maxStart / kClipStep).round() : null,
                label: clipFmtTime(_start),
                onChanged: _maxStart <= 0
                    ? null
                    : (v) {
                        _stopPreview();
                        setState(
                            () => _applyWindow(v, _end, keepLength: true));
                      },
              ),
            ),
            Text(
              _duration > 0
                  ? 'Track length: ${clipFmtTime(_duration)}'
                  : 'Choose where the clip starts and how long it runs.',
              style: TextStyle(color: surfaces.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                OutlinedButton.icon(
                  onPressed: _previewing ? _stopPreview : _preview,
                  icon: Icon(_previewing ? Icons.stop : Icons.play_arrow),
                  label: Text(
                      _previewing ? 'Stop' : 'Preview ${clipFmtLen(_windowLength)}'),
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
                      : Text(widget.saveLabel),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
