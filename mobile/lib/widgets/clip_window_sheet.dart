import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../core/theme/networx_extensions.dart';

String clipFmtTime(int totalSeconds) {
  final s = totalSeconds < 0 ? 0 : totalSeconds;
  final m = s ~/ 60;
  final rem = s % 60;
  return '$m:${rem.toString().padLeft(2, '0')}';
}

/// Parse "m:ss" or a plain seconds string into whole seconds. Null if invalid.
int? clipParseTime(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return null;
  if (trimmed.contains(':')) {
    final parts = trimmed.split(':');
    if (parts.length != 2) return null;
    final m = int.tryParse(parts[0].trim());
    final s = int.tryParse(parts[1].trim());
    if (m == null || s == null || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  final n = int.tryParse(trimmed);
  return n;
}

/// Generic window picker for trimming a clip from an audio source: start/end
/// time fields, ±1s nudge buttons, a start scrubber, and a looping preview of
/// just the selected window. Works with a remote [audioUrl] or local
/// [audioFilePath]. Used for the paid-preview sample (5–30s) and the Discover
/// swipe clip (5–15s), at both upload time and post-upload editing.
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
  final int initialStart;
  final int initialEnd;
  final Future<void> Function(int startSeconds, int endSeconds) onSave;

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
  int _duration = 0;
  int _start = 0;
  int _end = 0;
  bool _saving = false;
  bool _previewing = false;

  int get _minLen => widget.minLength;
  int get _maxLen => widget.maxLength;

  @override
  void initState() {
    super.initState();
    _duration = widget.durationSeconds ?? 0;
    _start = widget.initialStart;
    _end = widget.initialEnd > _start ? widget.initialEnd : _start + _maxLen;
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
          if (_duration <= 0) _duration = dur!.inSeconds;
          _applyWindow(_start, _end, keepLength: true);
        });
      }
    } catch (_) {
      // Preview unavailable; saving still works.
    }
  }

  int get _maxStart {
    final d = _duration > 0 ? _duration : _maxLen;
    final m = d - _minLen;
    return m < 0 ? 0 : m;
  }

  int get _windowLength => (_end - _start).clamp(0, _maxLen);

  /// Clamp the start/end pair so the window stays min–max and inside the track.
  void _applyWindow(int nextStart, int nextEnd, {bool keepLength = false}) {
    final dur = _duration;
    final upperStart = dur > 0 ? (dur - _minLen).clamp(0, dur) : 1 << 30;
    var s = nextStart.clamp(0, upperStart);

    var e = nextEnd;
    if (keepLength) {
      final length = (_end - _start).clamp(_minLen, _maxLen);
      e = s + length;
    }
    if (e < s + _minLen) e = s + _minLen;
    if (e > s + _maxLen) e = s + _maxLen;
    if (dur > 0 && e > dur) {
      e = dur;
      if (e - s < _minLen) s = (e - _minLen).clamp(0, e);
      if (e - s > _maxLen) s = e - _maxLen;
    }
    _start = s;
    _end = e;
    _syncText();
  }

  void _nudgeStart(int delta) {
    _stopPreview();
    setState(() => _applyWindow(_start + delta, _end, keepLength: true));
  }

  void _nudgeEnd(int delta) {
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
        start: Duration(seconds: _start),
        end: Duration(seconds: _end),
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
            // Start time with -1s / +1s nudge buttons and a text field.
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _startCtrl,
                    keyboardType: TextInputType.text,
                    decoration: const InputDecoration(
                      labelText: 'Start (m:ss)',
                      isDense: true,
                      border: OutlineInputBorder(),
                    ),
                    onEditingComplete: _commitStartText,
                    onSubmitted: (_) => _commitStartText(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.outlined(
                  tooltip: 'Nudge start back 1s',
                  onPressed: () => _nudgeStart(-1),
                  icon: const Icon(Icons.remove),
                ),
                IconButton.outlined(
                  tooltip: 'Nudge start forward 1s',
                  onPressed: () => _nudgeStart(1),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _endCtrl,
                    keyboardType: TextInputType.text,
                    decoration: InputDecoration(
                      labelText: 'End (m:ss) — $_minLen to ${_maxLen}s window',
                      isDense: true,
                      border: const OutlineInputBorder(),
                    ),
                    onEditingComplete: _commitEndText,
                    onSubmitted: (_) => _commitEndText(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.outlined(
                  tooltip: 'Nudge end back 1s',
                  onPressed: () => _nudgeEnd(-1),
                  icon: const Icon(Icons.remove),
                ),
                IconButton.outlined(
                  tooltip: 'Nudge end forward 1s',
                  onPressed: () => _nudgeEnd(1),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Window: ${clipFmtTime(_start)} – ${clipFmtTime(_end)}  ·  ${_windowLength}s',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            Slider(
              value: _start.toDouble().clamp(0, _maxStart.toDouble()),
              min: 0,
              max: _maxStart.toDouble() <= 0 ? 1 : _maxStart.toDouble(),
              divisions: _maxStart > 0 ? _maxStart : null,
              label: clipFmtTime(_start),
              onChanged: _maxStart <= 0
                  ? null
                  : (v) {
                      _stopPreview();
                      setState(
                          () => _applyWindow(v.round(), _end, keepLength: true));
                    },
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
                  label:
                      Text(_previewing ? 'Stop' : 'Preview ${_windowLength}s'),
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
