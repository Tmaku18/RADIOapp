import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/services/api_service.dart';

class TimedLine {
  final int startMs;
  final int? endMs;
  final String text;

  TimedLine({required this.startMs, this.endMs, required this.text});

  factory TimedLine.fromJson(Map<String, dynamic> json) => TimedLine(
        startMs: (json['startMs'] as num).toInt(),
        endMs: json['endMs'] != null ? (json['endMs'] as num).toInt() : null,
        text: json['text'] as String? ?? '',
      );
}

class SyncedLyricsPanel extends StatefulWidget {
  final String? songId;
  final Stream<Duration> positionStream;
  final Duration Function() currentPosition;

  const SyncedLyricsPanel({
    super.key,
    required this.songId,
    required this.positionStream,
    required this.currentPosition,
  });

  @override
  State<SyncedLyricsPanel> createState() => _SyncedLyricsPanelState();
}

class _SyncedLyricsPanelState extends State<SyncedLyricsPanel> {
  List<TimedLine>? _lines;
  String? _plainText;
  bool _loading = false;
  bool _collapsed = false;
  int _activeIndex = -1;
  String? _loadedSongId;
  StreamSubscription<Duration>? _posSub;

  final ScrollController _scrollCtrl = ScrollController();
  final List<GlobalKey> _lineKeys = [];

  @override
  void initState() {
    super.initState();
    _fetchLyrics();
    _posSub = widget.positionStream.listen(_onPosition);
  }

  @override
  void didUpdateWidget(covariant SyncedLyricsPanel old) {
    super.didUpdateWidget(old);
    if (widget.songId != old.songId) {
      _fetchLyrics();
    }
    if (widget.positionStream != old.positionStream) {
      _posSub?.cancel();
      _posSub = widget.positionStream.listen(_onPosition);
    }
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchLyrics() async {
    final id = widget.songId;
    if (id == null || id == _loadedSongId) return;
    _loadedSongId = id;
    setState(() {
      _loading = true;
      _lines = null;
      _plainText = null;
      _activeIndex = -1;
    });

    try {
      final resp = await ApiService().get('songs/$id/lyrics');
      if (!mounted) return;
      final timed = resp['timedLines'];
      final plain = resp['plainText'] as String?;
      final parsed = <TimedLine>[];
      if (timed is List) {
        for (final item in timed) {
          if (item is Map<String, dynamic>) parsed.add(TimedLine.fromJson(item));
        }
      }
      setState(() {
        _lines = parsed.isEmpty ? null : parsed;
        _plainText = plain;
        _lineKeys.clear();
        if (_lines != null) {
          for (var i = 0; i < _lines!.length; i++) {
            _lineKeys.add(GlobalKey());
          }
        }
      });
    } catch (_) {
      // no lyrics available
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onPosition(Duration pos) {
    if (_lines == null || _lines!.isEmpty) return;
    final ms = pos.inMilliseconds;
    int best = -1;
    for (int i = 0; i < _lines!.length; i++) {
      if (_lines![i].startMs <= ms) {
        best = i;
      } else {
        break;
      }
    }
    if (best != _activeIndex) {
      setState(() => _activeIndex = best);
      _scrollToActive(best);
    }
  }

  void _scrollToActive(int index) {
    if (_collapsed || index < 0 || index >= _lineKeys.length) return;
    final key = _lineKeys[index];
    final ctx = key.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.4,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasLyrics =
        (_lines != null && _lines!.isNotEmpty) ||
        (_plainText != null && _plainText!.trim().isNotEmpty);
    if (!hasLyrics && !_loading) return const SizedBox.shrink();

    final scheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: scheme.onSurface.withValues(alpha: 0.12),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            onTap: () => setState(() => _collapsed = !_collapsed),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Text(
                    '♪ Lyrics',
                    style: textTheme.labelMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    _collapsed ? Icons.expand_more : Icons.expand_less,
                    size: 18,
                    color: scheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
          if (!_collapsed)
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    )
                  : _lines != null && _lines!.isNotEmpty
                      ? ListView.builder(
                          controller: _scrollCtrl,
                          padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                          itemCount: _lines!.length,
                          itemBuilder: (context, i) {
                            final isActive = i == _activeIndex;
                            final isPast = i < _activeIndex;
                            return Padding(
                              key: _lineKeys[i],
                              padding: const EdgeInsets.symmetric(vertical: 3),
                              child: AnimatedDefaultTextStyle(
                                duration: const Duration(milliseconds: 280),
                                style: textTheme.bodyMedium!.copyWith(
                                  color: isActive
                                      ? scheme.onSurface
                                      : isPast
                                          ? scheme.onSurface.withValues(alpha: 0.35)
                                          : scheme.onSurface.withValues(alpha: 0.6),
                                  fontWeight:
                                      isActive ? FontWeight.w700 : FontWeight.w400,
                                  fontSize: isActive ? 15 : 14,
                                ),
                                child: Text(
                                  _lines![i].text.isEmpty ? '♪' : _lines![i].text,
                                ),
                              ),
                            );
                          },
                        )
                      : _plainText != null
                          ? SingleChildScrollView(
                              padding:
                                  const EdgeInsets.fromLTRB(14, 0, 14, 14),
                              child: Text(
                                _plainText!,
                                style: textTheme.bodyMedium?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                  height: 1.6,
                                ),
                              ),
                            )
                          : const SizedBox.shrink(),
            ),
        ],
      ),
    );
  }
}
