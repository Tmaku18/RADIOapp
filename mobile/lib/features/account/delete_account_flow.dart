import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/users_service.dart';

const _confirmWord = 'delete';

/// Warns, requires the word "delete", then schedules deletion for 48 hours.
Future<void> confirmAndScheduleAccountDeletion(BuildContext context) async {
  final auth = Provider.of<AuthService>(context, listen: false);
  if (auth.currentUser == null) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sign in to delete your account.')),
    );
    return;
  }

  final scheme = Theme.of(context).colorScheme;
  final confirmCtrl = TextEditingController();

  final result = await showDialog<bool>(
    context: context,
    builder: (dialogCtx) {
      return StatefulBuilder(
        builder: (ctx, setLocal) {
          final canConfirm = confirmCtrl.text.trim() == _confirmWord;
          return AlertDialog(
            title: const Text('Delete account'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'You will be signed out on this device right away.\n\n'
                    'Your profile, songs, messages, library, and other account '
                    'data stay for 48 hours. They are not deleted immediately.\n\n'
                    'Sign in again within those 48 hours and your account is '
                    'restored, as if you never asked to delete it.\n\n'
                    'After 48 hours the account and its data are permanently '
                    'deleted. That cannot be undone.\n\n'
                    'If you subscribed in the App Store or Google Play, cancel '
                    'that subscription in your store account first. Deleting '
                    'the Networx account does not cancel a store subscription.',
                  ),
                  const SizedBox(height: 16),
                  const Text('Type delete to confirm. It must be lowercase:'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: confirmCtrl,
                    autofocus: true,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: const InputDecoration(
                      hintText: 'delete',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) => setLocal(() {}),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogCtx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: scheme.error,
                  foregroundColor: scheme.onError,
                ),
                onPressed: canConfirm
                    ? () => Navigator.pop(dialogCtx, true)
                    : null,
                child: const Text('Delete account'),
              ),
            ],
          );
        },
      );
    },
  );
  confirmCtrl.dispose();

  if (result != true || !context.mounted) return;

  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => const Center(child: CircularProgressIndicator()),
  );

  try {
    await UsersService().deleteMyAccount();
    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();

    try {
      await auth.signOut();
    } catch (_) {}

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Your account is scheduled for deletion. Sign in again within 48 hours to restore it and keep your data.',
        ),
      ),
    );
    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (_) => false,
    );
  } catch (e) {
    if (!context.mounted) return;
    Navigator.of(context, rootNavigator: true).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed to delete account: $e')),
    );
  }
}
