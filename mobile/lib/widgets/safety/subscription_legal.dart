import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Apple 3.1.2 disclosures for auto-renewing subscriptions.
class SubscriptionLegal extends StatelessWidget {
  const SubscriptionLegal({super.key, required this.priceLabel});

  final String priceLabel;

  static const termsUrl = 'https://pro-networx.com/terms';
  static const privacyUrl = 'https://pro-networx.com/privacy';

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodySmall;
    final manageUrl = Platform.isIOS
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Renews monthly at $priceLabel until you cancel. '
          'Payment is charged to your store account.',
          style: style,
        ),
        Wrap(
          spacing: 4,
          children: [
            TextButton(
              onPressed: () => _open(termsUrl),
              child: const Text('Terms of Use'),
            ),
            TextButton(
              onPressed: () => _open(privacyUrl),
              child: const Text('Privacy Policy'),
            ),
            TextButton(
              onPressed: () => _open(manageUrl),
              child: const Text('Manage subscription'),
            ),
          ],
        ),
      ],
    );
  }
}
