import 'package:flutter/material.dart';
import '../../core/navigation/app_routes.dart';
import '../../widgets/dimension/dimension_widgets.dart';

/// Credit packages are retired. Artists buy placements per song from Studio.
class PaymentScreen extends StatelessWidget {
  const PaymentScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'Placements',
      showNeonLine: true,
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'There is no credit bank. Buy placements for an approved song from Studio — one is \$1.99, and packs are \$4.99, \$9.99, \$17.99, \$39.99, \$75.99, and \$150.',
              style: TextStyle(
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.75),
                fontSize: 15,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                Navigator.pushReplacementNamed(context, AppRoutes.studio);
              },
              child: const Text('Open Studio'),
            ),
          ],
        ),
      ),
    );
  }
}
