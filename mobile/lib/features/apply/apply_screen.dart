import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';
import '../../core/navigation/app_routes.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Shown when a Listener hits Upload. Offers Trial by Fire (artist) or Producer.
class ApplyScreen extends StatefulWidget {
  const ApplyScreen({super.key});

  @override
  State<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends State<ApplyScreen> {
  bool _isSubmitting = false;
  String? _error;
  /// `artist` = Trial by Fire / upload path; `service_provider` = Producer.
  String _selectedRole = 'artist';

  Future<void> _switchRole() async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      await auth.refreshIdToken();
      if (_selectedRole == 'service_provider') {
        await auth.requestProducerUpgrade();
      } else {
        await auth.requestArtistUpgrade();
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(AppRoutes.upload);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Join Trial by Fire')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Become an artist',
              style: DimensionTypography.pageTitle(fontSize: 24),
            ),
            const SizedBox(height: 8),
            Text(
              'Want to upload music? Join Trial by Fire and become an Artist — '
              'submit tracks, compete on the leaderboard, and grow on Networx. '
              'You can also upgrade to Producer to offer services on Pro-Networx.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            DropdownButtonFormField<String>(
              key: ValueKey('apply-role-$_selectedRole'),
              initialValue: _selectedRole,
              decoration: const InputDecoration(
                labelText: 'I want to',
                border: OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(
                  value: 'artist',
                  child: Text('Join Trial by Fire as an Artist'),
                ),
                DropdownMenuItem(
                  value: 'service_provider',
                  child: Text('Become a Producer'),
                ),
              ],
              onChanged: _isSubmitting
                  ? null
                  : (value) {
                      if (value != null) setState(() => _selectedRole = value);
                    },
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(
                _error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error),
              ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSubmitting ? null : _switchRole,
                child: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        _selectedRole == 'service_provider'
                            ? 'Become a Producer'
                            : 'Join Trial by Fire',
                      ),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Not now'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
