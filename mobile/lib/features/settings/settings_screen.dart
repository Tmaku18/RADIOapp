import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/services/notification_settings_service.dart';
import '../../core/services/push_notification_service.dart';
import '../../core/services/users_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/auth/auth_service.dart';
import '../../core/models/user.dart' as app_user;

/// Settings screen with Instagram/Twitch-style sectioned list:
/// Account, Preferences, Notifications, Security & Privacy, Payments,
/// Creator (artists), Admin (admins), Help & Legal.
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
  app_user.User? _me;
  String? _role;

  bool _notificationsEnabled = true;
  bool _upNextAlerts = true;
  bool _liveNowAlerts = true;
  bool _songApprovalAlerts = true;
  bool _soundEnabled = true;
  bool _vibrationEnabled = true;
  bool _artistLikeMuted = false;
  int _artistLikeMinLikesTrigger = 1;
  int _artistLikeCooldownMinutes = 0;
  bool _savingArtistLikeSettings = false;

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
    final role = me['role'] as String?;
    final discoverable = (me['discoverable'] ?? true) == true;
    Map<String, dynamic>? artistLikeSettings;
    if (role == 'artist' || role == 'admin') {
      try {
        artistLikeSettings =
            await _usersService.getArtistLikeNotificationSettings();
      } catch (_) {
        artistLikeSettings = null;
      }
    }
    app_user.User? user;
    try {
      user = await auth.getUserProfile();
    } catch (_) {}

    if (mounted) {
      setState(() {
        _me = user;
        _role = role ?? user?.role;
        _systemNotificationsEnabled = systemEnabled;
        _notificationsEnabled = settings['notificationsEnabled'] ?? true;
        _upNextAlerts = settings['upNextAlerts'] ?? true;
        _liveNowAlerts = settings['liveNowAlerts'] ?? true;
        _songApprovalAlerts = settings['songApprovalAlerts'] ?? true;
        _soundEnabled = settings['soundEnabled'] ?? true;
        _vibrationEnabled = settings['vibrationEnabled'] ?? true;
        _artistLikeMuted = (artistLikeSettings?['muted'] ?? false) == true;
        _artistLikeMinLikesTrigger =
            ((artistLikeSettings?['minLikesTrigger'] ?? 1) as num).toInt();
        _artistLikeCooldownMinutes =
            ((artistLikeSettings?['cooldownMinutes'] ?? 0) as num).toInt();
        _discoverable = discoverable;
        _isLoading = false;
      });
    }
  }

  Future<void> _saveArtistLikeSettings({
    bool? muted,
    int? minLikesTrigger,
    int? cooldownMinutes,
  }) async {
    if (_savingArtistLikeSettings) return;
    setState(() => _savingArtistLikeSettings = true);
    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();
      final updated = await _usersService.updateArtistLikeNotificationSettings(
        muted: muted,
        minLikesTrigger: minLikesTrigger,
        cooldownMinutes: cooldownMinutes,
      );
      if (!mounted) return;
      setState(() {
        _artistLikeMuted = (updated['muted'] ?? _artistLikeMuted) == true;
        _artistLikeMinLikesTrigger =
            ((updated['minLikesTrigger'] ?? _artistLikeMinLikesTrigger) as num)
                .toInt();
        _artistLikeCooldownMinutes =
            ((updated['cooldownMinutes'] ?? _artistLikeCooldownMinutes) as num)
                .toInt();
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save artist like notification settings'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _savingArtistLikeSettings = false);
      }
    }
  }

  Future<int?> _promptForInt({
    required String title,
    required String hint,
    required int initialValue,
    required int min,
    required int max,
  }) async {
    final controller = TextEditingController(text: initialValue.toString());
    return showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(title),
          content: TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(hintText: hint),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                final parsed = int.tryParse(controller.text.trim());
                if (parsed == null || parsed < min || parsed > max) {
                  ScaffoldMessenger.of(this.context).showSnackBar(
                    SnackBar(
                      content: Text('Enter a value between $min and $max'),
                    ),
                  );
                  return;
                }
                Navigator.pop(context, parsed);
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );
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
        setState(() => _savingDiscoverable = false);
      }
    }
  }

  Future<void> _toggleMasterNotifications(bool value) async {
    setState(() => _notificationsEnabled = value);
    await _settingsService.setNotificationsEnabled(value);

    if (value && !_systemNotificationsEnabled) {
      final granted = await _pushService.requestPermissionLazy();
      if (mounted) {
        setState(() => _systemNotificationsEnabled = granted);
        if (!granted) _showPermissionDeniedDialog();
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
    final role = _role ?? _me?.role;
    final isArtist = role == 'artist' || role == 'admin';
    final isAdmin = role == 'admin';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings and activity'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              children: [
                if (!_systemNotificationsEnabled)
                  Container(
                    color: Colors.amber.shade100,
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber, color: Colors.amber.shade800, size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'System notifications are disabled. Enable them in your device settings.',
                            style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),

                _section('Account', [
                  _navTile(
                    context,
                    icon: Icons.person_outline,
                    title: 'Profile',
                    subtitle: 'Display name, photo, bio, headline',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.profile),
                  ),
                ]),

                _section('Preferences', [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Theme',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: Theme.of(context).colorScheme.onSurface,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Consumer<ThemeController>(
                          builder: (context, theme, _) {
                            return SegmentedButton<ThemeMode>(
                              segments: const [
                                ButtonSegment(value: ThemeMode.system, label: Text('System')),
                                ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
                                ButtonSegment(value: ThemeMode.light, label: Text('Light')),
                              ],
                              selected: <ThemeMode>{theme.themeMode},
                              onSelectionChanged: (v) => theme.setThemeMode(v.first),
                            );
                          },
                        ),
                        const SizedBox(height: 6),
                        Consumer<ThemeController>(
                          builder: (context, theme, _) {
                            return Text(
                              theme.themeMode == ThemeMode.dark
                                  ? 'The Collective (default)'
                                  : theme.themeMode == ThemeMode.light
                                      ? 'Soft studio light'
                                      : 'Match your device',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                                  ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ]),

                _section('Notifications', [
                  SwitchListTile(
                    title: const Text('Enable Notifications'),
                    subtitle: const Text('Master toggle for all notifications'),
                    value: _notificationsEnabled,
                    onChanged: _toggleMasterNotifications,
                    secondary: const Icon(Icons.notifications_outlined),
                    activeThumbColor: primary,
                  ),
                  SwitchListTile(
                    title: const Text('Up Next Alerts'),
                    subtitle: const Text('60 seconds before your song plays'),
                    value: _upNextAlerts && _notificationsEnabled,
                    onChanged: _notificationsEnabled
                        ? (v) async {
                            setState(() => _upNextAlerts = v);
                            await _settingsService.setUpNextAlertsEnabled(v);
                          }
                        : null,
                    secondary: const Icon(Icons.queue_music_outlined),
                    activeThumbColor: primary,
                  ),
                  SwitchListTile(
                    title: const Text('Live Now Alerts'),
                    subtitle: const Text('When your song starts playing'),
                    value: _liveNowAlerts && _notificationsEnabled,
                    onChanged: _notificationsEnabled
                        ? (v) async {
                            setState(() => _liveNowAlerts = v);
                            await _settingsService.setLiveNowAlertsEnabled(v);
                          }
                        : null,
                    secondary: const Icon(Icons.play_circle_outline),
                    activeThumbColor: primary,
                  ),
                  SwitchListTile(
                    title: const Text('Song Approval Alerts'),
                    subtitle: const Text('When your song is approved or rejected'),
                    value: _songApprovalAlerts && _notificationsEnabled,
                    onChanged: _notificationsEnabled
                        ? (v) async {
                            setState(() => _songApprovalAlerts = v);
                            await _settingsService.setSongApprovalAlertsEnabled(v);
                          }
                        : null,
                    secondary: const Icon(Icons.check_circle_outline),
                    activeThumbColor: primary,
                  ),
                  SwitchListTile(
                    title: const Text('Sound'),
                    subtitle: const Text('Play a sound when notifications arrive'),
                    value: _soundEnabled && _notificationsEnabled,
                    onChanged: _notificationsEnabled
                        ? (v) async {
                            setState(() => _soundEnabled = v);
                            await _settingsService.setSoundEnabled(v);
                          }
                        : null,
                    secondary: const Icon(Icons.volume_up_outlined),
                    activeThumbColor: primary,
                  ),
                  SwitchListTile(
                    title: const Text('Vibration'),
                    subtitle: const Text('Vibrate when notifications arrive'),
                    value: _vibrationEnabled && _notificationsEnabled,
                    onChanged: _notificationsEnabled
                        ? (v) async {
                            setState(() => _vibrationEnabled = v);
                            await _settingsService.setVibrationEnabled(v);
                          }
                        : null,
                    secondary: const Icon(Icons.vibration_outlined),
                    activeThumbColor: primary,
                  ),
                  if (isArtist) ...[
                    const Divider(height: 1),
                    SwitchListTile(
                      title: const Text('Mute song-like notifications'),
                      subtitle: const Text(
                        'Stop notifications when listeners like your songs',
                      ),
                      value: _artistLikeMuted,
                      onChanged: _savingArtistLikeSettings
                          ? null
                          : (v) async {
                              setState(() => _artistLikeMuted = v);
                              await _saveArtistLikeSettings(muted: v);
                            },
                      secondary: const Icon(Icons.favorite_border),
                      activeThumbColor: primary,
                    ),
                    ListTile(
                      leading: const Icon(Icons.flag_outlined),
                      title: const Text('Minimum likes to notify'),
                      subtitle: Text(
                        _artistLikeMinLikesTrigger <= 1
                            ? 'Notify on every like'
                            : 'Notify on $_artistLikeMinLikesTrigger, ${_artistLikeMinLikesTrigger * 2}, ... likes',
                      ),
                      trailing: Text('$_artistLikeMinLikesTrigger'),
                      onTap: _savingArtistLikeSettings
                          ? null
                          : () async {
                              final value = await _promptForInt(
                                title: 'Minimum likes trigger',
                                hint: 'Enter 1 to 1000',
                                initialValue: _artistLikeMinLikesTrigger,
                                min: 1,
                                max: 1000,
                              );
                              if (value == null) return;
                              setState(() => _artistLikeMinLikesTrigger = value);
                              await _saveArtistLikeSettings(
                                minLikesTrigger: value,
                              );
                            },
                    ),
                    ListTile(
                      leading: const Icon(Icons.schedule_outlined),
                      title: const Text('Like notification cooldown'),
                      subtitle: Text(
                        _artistLikeCooldownMinutes <= 0
                            ? 'No cooldown'
                            : 'At most one every $_artistLikeCooldownMinutes minute(s)',
                      ),
                      trailing: Text(
                        _artistLikeCooldownMinutes <= 0
                            ? 'Off'
                            : '${_artistLikeCooldownMinutes}m',
                      ),
                      onTap: _savingArtistLikeSettings
                          ? null
                          : () async {
                              final value = await _promptForInt(
                                title: 'Cooldown minutes',
                                hint: 'Enter 0 to 10080',
                                initialValue: _artistLikeCooldownMinutes,
                                min: 0,
                                max: 10080,
                              );
                              if (value == null) return;
                              setState(() => _artistLikeCooldownMinutes = value);
                              await _saveArtistLikeSettings(
                                cooldownMinutes: value,
                              );
                            },
                    ),
                  ],
                ]),

                _section('Security & Privacy', [
                  SwitchListTile(
                    title: const Text('Discoverable in heatmap'),
                    subtitle: const Text('Allow people nearby to discover you'),
                    value: _discoverable,
                    onChanged: _savingDiscoverable ? null : _toggleDiscoverable,
                    secondary: const Icon(Icons.visibility_outlined),
                    activeThumbColor: primary,
                  ),
                ]),

                _section('Payments & Subscriptions', [
                  _navTile(
                    context,
                    icon: Icons.credit_card_outlined,
                    title: 'Payments',
                    subtitle: 'Payment methods, billing',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.payment),
                  ),
                ]),

                if (isArtist)
                  _section('Creator', [
                    _navTile(
                      context,
                      icon: Icons.library_music_outlined,
                      title: 'Studio & Songs',
                      subtitle: 'Upload and rotation',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.studio),
                    ),
                  ]),

                if (isAdmin)
                  _section('Admin', [
                    _navTile(
                      context,
                      icon: Icons.admin_panel_settings_outlined,
                      title: 'Admin dashboard',
                      subtitle: 'Moderation, fallback, users',
                      onTap: () => Navigator.pushNamed(context, AppRoutes.adminDashboard),
                    ),
                  ]),

                _section('Help & Legal', [
                  _navTile(
                    context,
                    icon: Icons.help_outline,
                    title: 'Help & FAQ',
                    subtitle: 'Answers and support',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.about),
                  ),
                  _navTile(
                    context,
                    icon: Icons.discord,
                    title: 'Discord Support',
                    subtitle: 'Chat with support and community',
                    onTap: () async {
                      final uri = Uri.parse('https://discord.gg/networx');
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri, mode: LaunchMode.externalApplication);
                      }
                    },
                  ),
                  _navTile(
                    context,
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy & Terms',
                    subtitle: 'Privacy policy, terms of service',
                    onTap: () => Navigator.pushNamed(context, AppRoutes.about),
                  ),
                ]),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Reset Settings'),
                          content: const Text(
                            'Reset all notification settings to defaults?',
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
                    icon: const Icon(Icons.restore, size: 20),
                    label: const Text('Reset to Defaults'),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
    );
  }

  Widget _section(String title, List<Widget> tiles) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        ...tiles,
        const Divider(height: 1),
      ],
    );
  }

  Widget _navTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Icon(icon, size: 24),
      title: Text(title),
      subtitle: Text(
        subtitle,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
