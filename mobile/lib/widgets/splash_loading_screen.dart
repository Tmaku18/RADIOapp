import 'package:flutter/material.dart';
import '../core/theme/networx_tokens.dart';

/// Branded loading / splash surface shown while the app determines auth state.
///
/// Uses the tiled cyan butterfly artwork as a full-bleed background with the
/// NETWORX logo centered and a subtle progress indicator beneath it. The
/// background art is always dark, so the bright cyan logo is used in both light
/// and dark themes for legibility.
class SplashLoadingScreen extends StatelessWidget {
  const SplashLoadingScreen({super.key, this.message});

  /// Optional status text shown under the spinner (e.g. "Tuning in…").
  final String? message;

  static const String _backgroundAsset =
      'assets/images/branding/loading-bg.png';
  static const String _logoAsset = 'assets/images/branding/networx-logo-cyan.png';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NetworxTokens.deepMidnight,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Tiled butterfly artwork background.
          Image.asset(
            _backgroundAsset,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stack) => const ColoredBox(
              color: NetworxTokens.deepMidnight,
            ),
          ),
          // Radial scrim to darken the edges and focus attention on the logo.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 0.95,
                colors: [
                  Color(0x000A0A0A),
                  Color(0x990A0A0A),
                  Color(0xE60A0A0A),
                ],
                stops: [0.0, 0.55, 1.0],
              ),
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Glow behind the logo so it pops against the dense pattern.
                Container(
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: NetworxTokens.electricCyan.withValues(alpha: 0.28),
                        blurRadius: 90,
                        spreadRadius: 8,
                      ),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: Image.asset(
                    _logoAsset,
                    width: 168,
                    height: 168,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(height: 36),
                const SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      NetworxTokens.electricCyan,
                    ),
                  ),
                ),
                if (message != null) ...[
                  const SizedBox(height: 18),
                  Text(
                    message!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: NetworxTokens.cloudDancer,
                      fontSize: 13,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
