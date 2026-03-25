import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';
import '../core/models/user.dart' as app_user;
import '../features/apply/apply_screen.dart';

/// Gem (artist) + Catalyst (service_provider) + admin — matches web `hasArtistCapability`.
class RequireGemCapability extends StatelessWidget {
  const RequireGemCapability({super.key, required this.child});

  final Widget child;

  static bool allowsRole(String? role) {
    return role == 'artist' ||
        role == 'service_provider' ||
        role == 'admin';
  }

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
        if (!allowsRole(role)) {
          return const ApplyScreen();
        }
        return child;
      },
    );
  }
}
