import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final AuthService _authService = AuthService();
  app_user.User? _user;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final user = await _authService.getUserProfile();
    setState(() {
      _user = user;
      _isLoading = false;
    });
  }

  Future<void> _signOut() async {
    await _authService.signOut();
    if (mounted) {
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _user == null
              ? const Center(child: Text('Failed to load profile'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Center(
                      child: CircleAvatar(
                        radius: 60,
                        backgroundImage: _user!.avatarUrl != null
                            ? CachedNetworkImageProvider(_user!.avatarUrl!)
                            : null,
                        child: _user!.avatarUrl == null
                            ? const Icon(Icons.person, size: 60)
                            : null,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: Text(
                        _user!.displayName ?? _user!.email,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Text(
                        _user!.email,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Center(
                      child: Chip(
                        label: Text(_user!.role.toUpperCase()),
                        backgroundColor: Colors.deepPurple.shade100,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (_user!.role == 'artist')
                      ListTile(
                        leading: const Icon(Icons.credit_card),
                        title: const Text('Credits'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          // Navigate to credits screen
                        },
                      ),
                    ListTile(
                      leading: const Icon(Icons.settings),
                      title: const Text('Settings'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        // Navigate to settings
                      },
                    ),
                    const Divider(),
                    ListTile(
                      leading: const Icon(Icons.logout, color: Colors.red),
                      title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
                      onTap: _signOut,
                    ),
                  ],
                ),
    );
  }
}
