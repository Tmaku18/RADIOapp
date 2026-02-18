import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_service.dart';

/// Mobile equivalent of the web `/apply` page.
///
/// If the backend supports upgrading, this screen can trigger it.
/// Otherwise it acts as a calm, premium “how to join” explainer.
class ApplyScreen extends StatefulWidget {
  const ApplyScreen({super.key});

  @override
  State<ApplyScreen> createState() => _ApplyScreenState();
}

class _ApplyScreenState extends State<ApplyScreen> {
  bool _isSubmitting = false;
  String? _error;
  bool _success = false;

  Future<void> _requestUpgrade() async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
      _success = false;
    });

    try {
      final auth = Provider.of<AuthService>(context, listen: false);
      // Backend parity with web: POST /users/upgrade-to-artist
      await auth.requestArtistUpgrade();
      if (!mounted) return;
      setState(() => _success = true);
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
      appBar: AppBar(title: const Text('Pro-Network')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Tap In',
              style: theme.textTheme.headlineMedium?.copyWith(fontFamily: 'Lora'),
            ),
            const SizedBox(height: 8),
            Text(
              'The Pro-Network is reserved for verified NETWORX artists. Join the rotation, get discovered, and unlock services + collabs.',
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Text(
                _error!,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.error),
              ),
            if (_success)
              Text(
                'Request received. You’ll hear back soon.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _isSubmitting ? null : _requestUpgrade,
                child: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Request Artist Access'),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Back'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

