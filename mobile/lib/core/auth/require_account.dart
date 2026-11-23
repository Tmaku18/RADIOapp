import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'auth_service.dart';
import '../navigation/app_routes.dart';

/// Returns true when a Firebase user is signed in.
/// Otherwise opens login and returns whether they finished signing in.
Future<bool> requireAccount(BuildContext context) async {
  final auth = Provider.of<AuthService>(context, listen: false);
  if (auth.currentUser != null) {
    await auth.clearGuest();
    return true;
  }
  await Navigator.of(context).pushNamed(AppRoutes.login);
  if (!context.mounted) return false;
  final signedIn =
      Provider.of<AuthService>(context, listen: false).currentUser != null;
  if (signedIn) {
    await Provider.of<AuthService>(context, listen: false).clearGuest();
  }
  return signedIn;
}
