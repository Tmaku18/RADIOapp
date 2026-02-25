import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/notification_settings_service.dart';
import '../../core/services/push_notification_service.dart';
import '../../core/services/users_service.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/auth/auth_service.dart';

/// Settings screen with notification preferences.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final NotificationSettingsService _settingsService = NotificationSettingsService();
  final PushNotificationService _pushService = PushNotificationService();
  final UsersService _usersService = UsersService();

  bool _isLoading = true;
  bool _systemNotificationsEnabled = false;
  bool _discoverable = true;
  bool _savingDiscoverable = false;

  // Settings state
  bool _notificationsEnabled = true;
  bool _upNextAlerts = true;
  bool _liveNowAlerts = true;
  bool _songApprovalAlerts = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final auth = Provider.of<AuthService>(context, listen: false);
    await _settingsService.initialize();
    
    final settings = await _settingsService.getAllSettings();
    final systemEnabled = await _pushService.areNotificationsEnabled();
    await auth.refreshIdToken();
    final me = await _usersService.getMe();
    final discoverable = (me['discoverable'] ?? true) == true;

    if (mounted) {
      setState(() {
        _systemNotificationsEnabled = systemEnabled;
        _notificationsEnabled = settings['notificationsEnabled'] ?? true;
        _upNextAlerts = settings['upNextAlerts'] ?? true;
        _liveNowAlerts = settings['liveNowAlerts'] ?? true;
        _songApprovalAlerts = settings['songApprovalAlerts'] ?? true;
        _soundEnabled = settings['soundEnabled'] ?? true;
        _vibrationEnabled = settings['vibrationEnabled'] ?? true;
        _discoverable = discoverable;
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleDiscoverable(bool value) async {
    if (_savingDiscoverable) return;
    setState(() {
      _discoverable = value;
      _savingDiscoverable = true;
    });
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();
      await _usersService.updateMe(discoverable: value);
    } finally {
      if (mounted) {
        setState(() {
          _savingDiscoverable = false;
        });
      }
    }
  }

  Future<void> _toggleMasterNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);
    await _settingsService.setNotificationsEnabled(value);
    
    if (value && !_systemNotificationsEnabled) {
      // Request system permission if enabling
      final granted = await _pushService.requestPermissionLazy();
      if (mounted) {
        setState(() => _systemNotificationsEnabled = granted);
        if (!granted) {
          _showPermissionDeniedDialog();
        }
      }
    }
  }

  void _showPermissionDeniedDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Notifications Disabled'),
        content: const Text(
          'Please enable notifications in your device settings to receive alerts when your song plays.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                _buildSectionHeader('Appearance'),
                Consumer<ThemeController>(
                  builder: (context, theme, child) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SegmentedButton<ThemeMode>(
                            segments: const [
                              ButtonSegment(
                                value: ThemeMode.system,
                                label: Text('System'),
                              ),
                              ButtonSegment(
                                value: ThemeMode.dark,
                                label: Text('Dark'),
                              ),
                              ButtonSegment(
                                value: ThemeMode.light,
                                label: Text('Light'),
                              ),
                            ],
                            selected: <ThemeMode>{theme.themeMode},
                            onSelectionChanged: (v) {
                              theme.setThemeMode(v.first);
                            },
                          ),
                          const SizedBox(height: 8),
                          Text(
                            theme.themeMode == ThemeMode.dark
                                ? 'The Collective (default)'
                                : theme.themeMode == ThemeMode.light
                                    ? 'Soft studio light'
                                    : 'Match your device setting',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const Divider(height: 1),

                _buildSectionHeader('Privacy'),
                SwitchListTile(
                  title: const Text('Discoverable in heatmap'),
                  subtitle: const Text('Allow people nearby to discover you in the local heatmap'),
                  value: _discoverable,
                  onChanged: _savingDiscoverable ? null : _toggleDiscoverable,
                  secondary: const Icon(Icons.visibility_outlined),
                  activeThumbColor: primary,
                ),

                const Divider(height: 1),

                // System notification status banner
                if (!_systemNotificationsEnabled)
                  Container(
                    color: Colors.amber.shade100,
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber, color: Colors.amber.shade800),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'System notifications are disabled. Enable them in your device settings.',
                            style: TextStyle(color: Colors.amber.shade900),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Notification Settings Section
                _buildSectionHeader('Notifications'),
                
                SwitchListTile(
                  title: const Text('Enable Notifications'),
                  subtitle: const Text('Master toggle for all notifications'),
                  value: _notificationsEnabled,
                  onChanged: _toggleMasterNotifications,
                  secondary: const Icon(Icons.notifications),
                  activeThumbColor: primary,
                ),

                const Divider(height: 1),

                // Artist Notification Types
                _buildSectionHeader('Artist Alerts'),
                
                SwitchListTile(
                  title: const Text('Up Next Alerts'),
                  subtitle: const Text('Get notified 60 seconds before your song plays'),
                  value: _upNextAlerts && _notificationsEnabled,
                  onChanged: _notificationsEnabled
                      ? (value) async {
                          setState(() => _upNextAlerts = value);
                          await _settingsService.setUpNextAlertsEnabled(value);
                        }
                      : null,
                  secondary: const Icon(Icons.queue_music),
                  activeThumbColor: primary,
                ),

                SwitchListTile(
                  title: const Text('Live Now Alerts'),
                  subtitle: const Text('Get notified when your song starts playing'),
                  value: _liveNowAlerts && _notificationsEnabled,
                  onChanged: _notificationsEnabled
                      ? (value) async {
                          setState(() => _liveNowAlerts = value);
                          await _settingsService.setLiveNowAlertsEnabled(value);
                        }
                      : null,
                  secondary: const Icon(Icons.play_circle),
                  activeThumbColor: primary,
                ),

                SwitchListTile(
                  title: const Text('Song Approval Alerts'),
                  subtitle: const Text('Get notified when your song is approved or rejected'),
                  value: _songApprovalAlerts && _notificationsEnabled,
                  onChanged: _notificationsEnabled
                      ? (value) async {
                          setState(() => _songApprovalAlerts = value);
                          await _settingsService.setSongApprovalAlertsEnabled(value);
                        }
                      : null,
                  secondary: const Icon(Icons.check_circle),
                  activeThumbColor: primary,
                ),

                const Divider(height: 1),

                // Sound & Vibration
                _buildSectionHeader('Sound & Vibration'),

                SwitchListTile(
                  title: const Text('Sound'),
                  subtitle: const Text('Play a sound when notifications arrive'),
                  value: _soundEnabled && _notificationsEnabled,
                  onChanged: _notificationsEnabled
                      ? (value) async {
                          setState(() => _soundEnabled = value);
                          await _settingsService.setSoundEnabled(value);
                        }
                      : null,
                  secondary: const Icon(Icons.volume_up),
                  activeThumbColor: primary,
                ),

                SwitchListTile(
                  title: const Text('Vibration'),
                  subtitle: const Text('Vibrate when notifications arrive'),
                  value: _vibrationEnabled && _notificationsEnabled,
                  onChanged: _notificationsEnabled
                      ? (value) async {
                          setState(() => _vibrationEnabled = value);
                          await _settingsService.setVibrationEnabled(value);
                        }
                      : null,
                  secondary: const Icon(Icons.vibration),
                  activeThumbColor: primary,
                ),

                const Divider(height: 32),

                // Reset button
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Reset Settings'),
                          content: const Text(
                            'This will reset all notification settings to their defaults. Continue?',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: const Text('Cancel'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text('Reset'),
                            ),
                          ],
                        ),
                      );

                      if (confirm == true) {
                        await _settingsService.resetToDefaults();
                        await _loadSettings();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Settings reset to defaults')),
                        );
                      }
                    },
                    icon: const Icon(Icons.restore),
                    label: const Text('Reset to Defaults'),
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: Theme.of(context).colorScheme.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
