import 'package:flutter/material.dart';

import '../../core/services/moderation_service.dart';
import '../../core/services/pro_networx_service.dart';
import '../../core/services/users_service.dart';

/// Apple Guideline 1.2: report objectionable content and block the user.
class ReportBlockSheet {
  static const reasons = <String>[
    'Spam',
    'Harassment or bullying',
    'Hate or discrimination',
    'Sexual content',
    'Violence or threats',
    'Copyright',
    'Something else',
  ];

  static Future<bool> show(
    BuildContext context, {
    required String userId,
    String? displayName,
    String? contextType,
    String? contextId,
    String? postId,
  }) async {
    if (userId.trim().isEmpty && (postId == null || postId.isEmpty)) {
      return false;
    }
    final name = (displayName ?? '').trim();
    final result = await showModalBottomSheet<_SafetyAction>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: Text(postId != null ? 'Report post' : 'Report'),
              subtitle: Text(
                name.isEmpty
                    ? 'Tell us what is wrong. We review every report.'
                    : 'Report $name. We review every report.',
              ),
              onTap: () => Navigator.pop(ctx, _SafetyAction.report),
            ),
            if (userId.trim().isNotEmpty)
              ListTile(
                leading: const Icon(Icons.block),
                title: Text(name.isEmpty ? 'Block' : 'Block $name'),
                subtitle: const Text(
                  'They will not be able to message you, and their posts will be hidden.',
                ),
                onTap: () => Navigator.pop(ctx, _SafetyAction.block),
              ),
          ],
        ),
      ),
    );
    if (result == null || !context.mounted) return false;
    if (result == _SafetyAction.report) {
      return _report(
        context,
        userId: userId,
        postId: postId,
        contextType: contextType,
        contextId: contextId,
      );
    }
    return _block(context, userId: userId, displayName: name);
  }

  static Future<bool> _report(
    BuildContext context, {
    required String userId,
    String? postId,
    String? contextType,
    String? contextId,
  }) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(title: Text('Why are you reporting this?')),
            for (final item in reasons)
              ListTile(
                title: Text(item),
                onTap: () => Navigator.pop(ctx, item),
              ),
          ],
        ),
      ),
    );
    if (reason == null || !context.mounted) return false;
    try {
      const contentTypes = {
        'story',
        'post',
        'comment',
        'room_chat',
        'live_chat',
        'message',
      };
      if (postId != null && postId.isNotEmpty) {
        await ProNetworxService().reportPost(postId, reason);
      }
      final contentId = (contextId ?? postId ?? '').trim();
      final contentType = contextType ?? (postId != null ? 'post' : null);
      if (contentType != null &&
          contentTypes.contains(contentType) &&
          contentId.isNotEmpty) {
        await ModerationService().report(
          targetType: contentType,
          targetId: contentId,
          reason: reason,
        );
      }
      if (userId.trim().isNotEmpty) {
        await UsersService().reportUser(
          userId,
          reason: reason,
          contextType: contextType ?? (postId != null ? 'post' : null),
          contextId: contextId ?? postId,
        );
      }
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

  static Future<bool> _block(
    BuildContext context, {
    required String userId,
    required String displayName,
  }) async {
    final who = displayName.isEmpty ? 'this person' : displayName;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Block $who?'),
        content: const Text(
          'They will not see your posts in their feed, and you will not see theirs. You can unblock them later in Settings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Block'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return false;
    try {
      await UsersService().blockUser(userId);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Blocked $who')));
      }
      return true;
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not block this account. Try again.'),
          ),
        );
      }
      return false;
    }
  }
}

enum _SafetyAction { report, block }
