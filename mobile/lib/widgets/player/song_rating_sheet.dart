import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/services/songs_service.dart';
import '../../core/theme/dimension_tokens.dart';

/// 1–10 rating sheet for the now-playing radio track.
class SongRatingSheet {
  static Future<int?> show(
    BuildContext context, {
    required String songId,
    required String songTitle,
    int? initialRating,
  }) async {
    if (songId.trim().isEmpty) return null;

    final selected = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => _SongRatingBody(
        songTitle: songTitle,
        initialRating: initialRating,
      ),
    );
    if (selected == null || !context.mounted) return null;

    try {
      HapticFeedback.selectionClick();
      final saved = await SongsService().rateSong(songId, selected);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Rated $saved / 10')),
        );
      }
      return saved;
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not save your rating. Try again.'),
          ),
        );
      }
      return null;
    }
  }
}

class _SongRatingBody extends StatefulWidget {
  const _SongRatingBody({
    required this.songTitle,
    this.initialRating,
  });

  final String songTitle;
  final int? initialRating;

  @override
  State<_SongRatingBody> createState() => _SongRatingBodyState();
}

class _SongRatingBodyState extends State<_SongRatingBody> {
  late int _rating;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialRating;
    _rating = (initial != null && initial >= 1 && initial <= 10) ? initial : 7;
  }

  @override
  Widget build(BuildContext context) {
    DimensionTokens.watch(context);
    final scheme = Theme.of(context).colorScheme;
    final title = widget.songTitle.trim().isEmpty
        ? 'Rate this song'
        : 'Rate "${widget.songTitle}"';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              'Score it from 1–10. This is separate from 🔥 / 💩.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: DimensionTokens.textSecondary,
                  ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (var i = 1; i <= 10; i++)
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: i == 10 ? 0 : 4),
                      child: Material(
                        color: _rating == i
                            ? scheme.primary
                            : DimensionTokens.textPrimary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () => setState(() => _rating = i),
                          child: SizedBox(
                            height: 40,
                            child: Center(
                              child: Text(
                                '$i',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: _rating == i
                                      ? scheme.onPrimary
                                      : DimensionTokens.textPrimary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(context, _rating),
              child: Text('Submit $_rating / 10'),
            ),
          ],
        ),
      ),
    );
  }
}
