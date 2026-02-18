import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;
import '../credits/credits_screen.dart';
import '../studio/studio_screen.dart';
import '../upload/upload_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  app_user.User? _user;
  bool _isLoading = true;
  bool _isSigningOut = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Load profile only once when dependencies are ready
    if (_isLoading && _user == null) {
      _loadProfile();
    }
  }

  Future<void> _loadProfile() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final user = await authService.getUserProfile();
    if (mounted) {
      setState(() {
        _user = user;
        _isLoading = false;
      });
    }
  }

  Future<void> _signOut() async {
    setState(() => _isSigningOut = true);
    final authService = Provider.of<AuthService>(context, listen: false);
    await authService.signOut();
    // Navigation is handled by AuthWrapper - no manual navigation needed
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
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
                        backgroundColor: Theme.of(context)
                            .colorScheme
                            .primary
                            .withValues(alpha: 0.12),
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (_user!.role == 'artist') ...[
                      ListTile(
                        leading: const Icon(Icons.mic_none),
                        title: const Text('Studio'),
                        subtitle: const Text('Your songs and rotation signals'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const StudioScreen()),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.library_music_outlined),
                        title: const Text('Credits'),
                        subtitle: const Text('Balance and history'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const CreditsScreen()),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.upload_outlined),
                        title: const Text('Upload'),
                        subtitle: const Text('Add a track to the rotation'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const UploadScreen()),
                          );
                        },
                      ),
                    ],
                    ListTile(
                      leading: const Icon(Icons.settings),
                      title: const Text('Settings'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.pushNamed(context, '/settings');
                      },
                    ),
                    const Divider(),
                    ListTile(
                      leading: _isSigningOut 
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.logout, color: Colors.red),
                      title: Text(
                        _isSigningOut ? 'Signing out...' : 'Sign Out',
                        style: TextStyle(color: _isSigningOut ? Colors.grey : Colors.red),
                      ),
                      onTap: _isSigningOut ? null : _signOut,
                    ),
                  ],
                ),
    );
  }
}
