import 'package:flutter/material.dart';

import '../../core/services/users_service.dart';

/// Report reasons common across Spotify, YouTube, TikTok, Instagram, etc.,
/// plus a quality option for radio songs.
class SongReportSheet {
  static const reasons = <String>[
    'Spam',
    'Harassment or bullying',
    'Hate speech or discrimination',
    'Sexual content',
    'Violence or threats',
    'Copyright infringement',
    'Misleading or scam',
    'Impersonation',
    'The song is bad',
    'Something else',
  ];

  static Future<bool> show(
    BuildContext context, {
    required String artistId,
    required String songId,
    required String songTitle,
    String? artistName,
  }) async {
    if (artistId.trim().isEmpty || songId.trim().isEmpty) return false;

    final reason = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              ListTile(
                title: Text(
                  songTitle.trim().isEmpty
                      ? 'Report this song'
                      : 'Report "$songTitle"',
                ),
                subtitle: Text(
                  artistName != null && artistName.trim().isNotEmpty
                      ? 'Report ${artistName.trim()}. We review every report.'
                      : 'Tell us what is wrong. We review every report.',
                ),
              ),
              for (final item in reasons)
                ListTile(
                  title: Text(item),
                  onTap: () => Navigator.pop(ctx, item),
                ),
            ],
          ),
        );
      },
    );
    if (reason == null || !context.mounted) return false;

    var details = '';
    if (reason == 'Something else' || reason == 'The song is bad') {
      final answered = await _askDetails(context, reason: reason);
      if (!context.mounted) return false;
      if (answered == null) return false;
      details = answered;
      if (reason == 'Something else' && details.trim().isEmpty) return false;
    }

    final payload =
        details.trim().isEmpty ? reason : '$reason: ${details.trim()}';
    final fullReason = '[Song: "$songTitle"] $payload'.trim();
    final clipped =
        fullReason.length <= 2000 ? fullReason : fullReason.substring(0, 2000);

    try {
      await UsersService().reportUser(
        artistId,
        reason: clipped,
        contextType: 'song',
        contextId: songId,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report sent. Thank you.')),
        );
      }
      return true;
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not send the report. Try again.'),
          ),
        );
      }
      return false;
    }
  }

  static Future<String?> _askDetails(
    BuildContext context, {
    required String reason,
  }) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(reason),
        content: TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 500,
          decoration: InputDecoration(
            hintText: reason == 'The song is bad'
                ? 'Optional: what makes it bad?'
                : 'Describe the issue…',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }
}
