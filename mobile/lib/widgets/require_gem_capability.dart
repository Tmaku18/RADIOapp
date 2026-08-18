import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';
import '../core/auth/role_helpers.dart';
import '../core/models/user.dart' as app_user;
import '../features/apply/apply_screen.dart';

/// Upload capability guard. Listeners are promoted to artist automatically
/// so they can upload without visiting Settings.
class RequireGemCapability extends StatefulWidget {
  const RequireGemCapability({super.key, required this.child});

  final Widget child;

  static bool allowsRole(String? role) => hasArtistCapability(role);

  @override
  State<RequireGemCapability> createState() => _RequireGemCapabilityState();
}

class _RequireGemCapabilityState extends State<RequireGemCapability> {
  late final Future<app_user.User?> _ready;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthService>(context, listen: false);
    _ready = _ensureArtist(auth);
  }

  Future<app_user.User?> _ensureArtist(AuthService auth) async {
    final profile = await auth.getUserProfile();
    if (RequireGemCapability.allowsRole(profile?.role)) return profile;
    try {
      await auth.requestArtistUpgrade();
      return await auth.getUserProfile();
    } catch (_) {
      return profile;
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<app_user.User?>(
      future: _ready,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final role = snapshot.data?.role;
        if (!RequireGemCapability.allowsRole(role)) {
          return const ApplyScreen();
        }
        return widget.child;
      },
    );
  }
}
