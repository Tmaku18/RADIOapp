import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';
import '../core/models/user.dart' as app_user;
import '../features/apply/apply_screen.dart';

/// Simple route guard for artist-only screens.
///
/// Web uses middleware + `/apply` redirects; on mobile we render `ApplyScreen`
/// in place so navigation stays native.
class RequireArtist extends StatelessWidget {
  final Widget child;
  const RequireArtist({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context, listen: false);
    return FutureBuilder<app_user.User?>(
      future: auth.getUserProfile(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final role = snapshot.data?.role;
        final isArtist = role == 'artist' || role == 'admin';
        if (!isArtist) return const ApplyScreen();
        return child;
      },
    );
  }
}

