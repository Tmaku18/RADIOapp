import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth/auth_service.dart';

class RequireAdmin extends StatelessWidget {
  final Widget child;

  const RequireAdmin({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: Provider.of<AuthService>(context, listen: false).getUserProfile(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final role = snapshot.data?.role ?? '';
        if (role != 'admin') {
          return Scaffold(
            appBar: AppBar(title: const Text('Admin Only')),
            body: const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('You must be an admin to access this area.'),
              ),
            ),
          );
        }
        return child;
      },
    );
  }
}
