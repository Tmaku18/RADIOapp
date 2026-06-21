import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/models/track.dart';
import '../../../core/services/radio_service.dart';
import '../../../core/theme/dimension_tokens.dart';
import '../../../widgets/dimension/dimension_widgets.dart';

/// Up-next queue peek — web RadioUpNextQueue parity (compact).
class RadioUpNextQueue extends StatefulWidget {
  const RadioUpNextQueue({super.key, required this.radioId, this.currentId});

  final String radioId;
  final String? currentId;

  @override
  State<RadioUpNextQueue> createState() => _RadioUpNextQueueState();
}

class _RadioUpNextQueueState extends State<RadioUpNextQueue> {
  final RadioService _radio = RadioService();
  Track? _next;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant RadioUpNextQueue oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.radioId != widget.radioId ||
        oldWidget.currentId != widget.currentId) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await _radio.peekNextTrack(radioId: widget.radioId);
    if (!mounted) return;
    setState(() {
      _next = res.track;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionLabel(number: 'UP', title: 'NEXT'),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator(minHeight: 2)
        else if (_next == null)
          Text(
            'Queue loading…',
            style: GoogleFonts.outfit(color: DimensionTokens.textMuted),
          )
        else
          GlassCard(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.queue_music, color: DimensionTokens.neonCyan),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _next!.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.outfit(
                          color: DimensionTokens.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        _next!.artistName,
                        style: GoogleFonts.outfit(
                          color: DimensionTokens.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
