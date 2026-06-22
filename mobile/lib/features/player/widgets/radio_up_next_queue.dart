import 'dart:async';

import 'package:audio_service/audio_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/services/audio_player_service.dart';
import '../../../core/services/radio_service.dart';
import '../../../core/services/station_events_service.dart';
import '../../../core/theme/dimension_tokens.dart';
import '../../../widgets/dimension/dimension_widgets.dart';

/// Up-next queue — web [RadioUpNextQueue] parity.
class RadioUpNextQueue extends StatefulWidget {
  const RadioUpNextQueue({super.key, required this.radioId, this.currentId});

  final String radioId;
  final String? currentId;

  @override
  State<RadioUpNextQueue> createState() => _RadioUpNextQueueState();
}

class _RadioUpNextQueueState extends State<RadioUpNextQueue> {
  final RadioService _radio = RadioService();
  List<UpcomingQueueTrack> _tracks = [];
  bool _loading = true;
  bool _loadError = false;
  StreamSubscription<DjBoothRealtimeEvent>? _boothSub;
  Timer? _pollTimer;
  int _emptyPollCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
    _boothSub = StationEventsService().djBoothStream.listen((event) {
      if (event.type == 'queue_updated') {
        unawaited(_load());
      }
    });
  }

  @override
  void didUpdateWidget(covariant RadioUpNextQueue oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.radioId != widget.radioId ||
        oldWidget.currentId != widget.currentId) {
      unawaited(_load());
    }
  }

  @override
  void dispose() {
    _boothSub?.cancel();
    _pollTimer?.cancel();
    super.dispose();
  }

  bool get _radioActive {
    final tag = AudioPlayerService().player.sequenceState.currentSource?.tag;
    if (tag is! MediaItem) return false;
    return tag.extras?['source'] == 'radio';
  }

  void _schedulePoll() {
    _pollTimer?.cancel();
    final pollMs = _tracks.isEmpty && _radioActive && _emptyPollCount < 12
        ? const Duration(seconds: 5)
        : const Duration(seconds: 60);
    _pollTimer = Timer.periodic(pollMs, (_) => unawaited(_load()));
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loadError = false;
    });
    try {
      final rows = await _radio.getUpcomingQueue(
        radioId: widget.radioId,
        limit: 12,
      );
      final currentId = widget.currentId;
      final filtered = currentId == null
          ? rows
          : rows.where((row) => row.id != currentId).toList();
      if (!mounted) return;
      setState(() {
        _tracks = filtered;
        _loading = false;
        if (filtered.isEmpty && _radioActive) {
          _emptyPollCount += 1;
        } else {
          _emptyPollCount = 0;
        }
      });
      _schedulePoll();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _tracks = [];
        _loading = false;
        _loadError = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= DimensionTokens.breakpointDesktop
        ? 4
        : width >= DimensionTokens.breakpointWide
            ? 3
            : width >= DimensionTokens.breakpointTablet
                ? 2
                : 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'UP NEXT IN THE QUEUE',
              style: GoogleFonts.jetBrainsMono(
                color: DimensionTokens.pink400,
                fontSize: 10,
                letterSpacing: 2.4,
              ),
            ),
            Text(
              _loading ? '…' : '${_tracks.length} TRACKS',
              style: GoogleFonts.jetBrainsMono(
                color: DimensionTokens.textMuted,
                fontSize: 10,
                letterSpacing: 1.8,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          )
        else if (_tracks.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Text(
              _loadError
                  ? 'Could not load the queue right now.'
                  : _radioActive
                      ? 'Loading upcoming tracks…'
                      : 'No upcoming tracks in the rotation yet.',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(color: DimensionTokens.textMuted),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 2.8,
            ),
            itemCount: _tracks.length,
            itemBuilder: (context, i) {
              final track = _tracks[i];
              return GlassCard(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: track.artworkUrl != null &&
                              track.artworkUrl!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: track.artworkUrl!,
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                            )
                          : Container(
                              width: 44,
                              height: 44,
                              color: DimensionTokens.bgSurface,
                              child: const Icon(
                                Icons.music_note,
                                color: DimensionTokens.neonCyan,
                              ),
                            ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            track.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              color: DimensionTokens.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            track.artistName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              color: DimensionTokens.textSecondary,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      track.temperaturePercent != null
                          ? '${track.temperaturePercent}°'
                          : track.likeCount?.toString() ?? '—',
                      style: GoogleFonts.jetBrainsMono(
                        color: DimensionTokens.neonCyan,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
