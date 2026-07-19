import 'package:flutter/material.dart';

/// NETWORX design tokens (dark-first, light-optional).
///
/// Keep token *names* aligned with web CSS variables where possible:
/// bg/surface/elevated/border/textPrimary/textSecondary/textMuted/primary/primaryHover/roseGold
class NetworxTokens {
  // PRO‑NETWORX / NETWORX Visual Identity — “SYSTEMATIC GLOW”
  // Frequency palette (web parity):
  // - Deep Midnight: #0A0A0A
  // - Charcoal Matte: #101010
  // - Electric Cyan:  #00F5FF
  // - Deep Cobalt:    #1A237E
  // - Cloud Dancer:   #F5F5F5
  static const Color deepMidnight = Color(0xFF0A0A0A);
  static const Color charcoalMatte = Color(0xFF101010);
  static const Color electricCyan = Color(0xFF00F5FF);
  static const Color electricCyanHover = Color(0xFF00C9D4);
  static const Color deepCobalt = Color(0xFF1A237E);
  static const Color cloudDancer = Color(0xFFF5F5F5);

  // Back-compat aliases (avoid broad refactors)
  static const Color obsidianNight = deepMidnight;
  static const Color butterflyElectric = electricCyan;
  static const Color butterflyElectricHover = electricCyanHover;
  static const Color starlightWhite = cloudDancer;
  static const Color radioactiveLime = Color(0xFF2ECC71);

  // Legacy brand tokens (kept to avoid broad refactors)
  static const Color amethyst = Color(0xFF6A0DAD);
  static const Color amethystGlow = Color(0xFF9B4DFF);
  // NOTE: legacy token name kept; now represents Radioactive Lime.
  static const Color roseGold = deepCobalt;

  // Status
  static const Color success = Color(0xFF2ECC71);
  static const Color warning = Color(0xFFF2C94C);
  static const Color error = Color(0xFFEB5757);

  // Listener brand override (electric primary)
  static const Color listenerCyan = butterflyElectric;

  // Dark (primary)
  static const Color darkBg = deepMidnight;
  static const Color darkSurface = charcoalMatte;
  static const Color darkElevated = Color(0xFF161616);
  static const Color darkBorder = Color(0x1AF5F5F5); // ~10% Cloud Dancer

  static const Color darkTextPrimary = cloudDancer;
  static const Color darkTextSecondary = Color(0xC7F5F5F5); // ~78%
  static const Color darkTextMuted = Color(0x99F5F5F5); // ~60%

  // Light (adaptive; dark is primary)
  static const Color lightBg = Color(0xFFFAFAFA);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightElevated = Color(0xFFF2F2F2);
  static const Color lightBorder = Color(0x1F0A0A0A); // ~12%

  static const Color lightTextPrimary = Color(0xFF0A0A0A);
  static const Color lightTextSecondary = Color(0xC70A0A0A); // ~78%
  static const Color lightTextMuted = Color(0x990A0A0A); // ~60%

  static const List<Color> signatureGradientStops = <Color>[
    deepMidnight,
    electricCyan,
    deepCobalt,
  ];
}

