import 'package:flutter/material.dart';

import '../../core/services/invite_service.dart';

/// Bottom sheet for handing the app to a friend over text, email, or anything
/// else on the device.
class InviteFriendsSheet extends StatelessWidget {
  const InviteFriendsSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => const InviteFriendsSheet(),
    );
  }

  Future<void> _handOff(
    BuildContext context,
    Future<bool> Function() send,
    String unavailableMessage,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final sent = await send();
    if (!sent) {
      // Nothing on this device can open the composer (no SIM, no mail account,
      // simulator). Leave the sheet up so the other options are still there.
      messenger.showSnackBar(SnackBar(content: Text(unavailableMessage)));
      return;
    }
    navigator.pop();
  }

  Future<void> _copy(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await InviteService.copyLink();
    navigator.pop();
    messenger.showSnackBar(
      const SnackBar(content: Text('Invite link copied')),
    );
  }

  Future<void> _shareAnywhere(BuildContext context) async {
    final navigator = Navigator.of(context);
    // The sheet's own bounds anchor the iPad popover.
    final box = context.findRenderObject() as RenderBox?;
    final origin = box != null && box.hasSize
        ? box.localToGlobal(Offset.zero) & box.size
        : null;
    await InviteService.shareAnywhere(origin: origin);
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Invite friends', style: theme.textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            InviteService.isBetaInvite
                ? 'Send a friend the beta invite so they can listen, vote, and '
                      'back artists with you.'
                : 'Send a friend the app so they can listen, vote, and back '
                      'artists with you.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 20),
          _InviteAction(
            icon: Icons.sms_outlined,
            label: 'Text message',
            subtitle: 'Opens Messages with the invite ready to send',
            onTap: () => _handOff(
              context,
              InviteService.shareViaText,
              'No messaging app available on this device',
            ),
          ),
          _InviteAction(
            icon: Icons.mail_outline,
            label: 'Email',
            subtitle: 'Opens Mail with the invite ready to send',
            onTap: () => _handOff(
              context,
              InviteService.shareViaEmail,
              'No mail account set up on this device',
            ),
          ),
          _InviteAction(
            icon: Icons.ios_share,
            label: 'More ways to share',
            subtitle: 'WhatsApp, Instagram, AirDrop and more',
            onTap: () => _shareAnywhere(context),
          ),
          _InviteAction(
            icon: Icons.link,
            label: 'Copy link',
            subtitle: InviteService.inviteLink,
            onTap: () => _copy(context),
          ),
        ],
      ),
    );
  }
}

class _InviteAction extends StatelessWidget {
  const _InviteAction({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: colors.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Icon(icon, color: colors.primary),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: theme.textTheme.titleSmall),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: colors.onSurfaceVariant,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
