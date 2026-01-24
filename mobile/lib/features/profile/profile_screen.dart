import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;

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

  /// Open the web dashboard for credit management.
  /// This allows mobile artists to manage their credits without
  /// needing a full Flutter implementation of the credit UI.
  Future<void> _openCreditsWebView() async {
    // TODO: Replace with your actual web dashboard URL
    const webDashboardUrl = 'http://localhost:3001/artist/credits';
    final uri = Uri.parse(webDashboardUrl);
    
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open web dashboard')),
        );
      }
    }
  }

  /// Open the web dashboard for viewing and managing songs.
  Future<void> _openMySongsWebView() async {
    // TODO: Replace with your actual web dashboard URL
    const webDashboardUrl = 'http://localhost:3001/artist/songs';
    final uri = Uri.parse(webDashboardUrl);
    
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open web dashboard')),
        );
      }
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
                    if (_user!.role == 'artist') ...[
                      ListTile(
                        leading: const Icon(Icons.account_balance_wallet, color: Colors.deepPurple),
                        title: const Text('Manage Credits'),
                        subtitle: const Text('Allocate credits to your songs'),
                        trailing: const Icon(Icons.open_in_new),
                        onTap: () => _openCreditsWebView(),
                      ),
                      ListTile(
                        leading: const Icon(Icons.library_music, color: Colors.deepPurple),
                        title: const Text('My Songs'),
                        subtitle: const Text('View your uploaded songs'),
                        trailing: const Icon(Icons.open_in_new),
                        onTap: () => _openMySongsWebView(),
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
