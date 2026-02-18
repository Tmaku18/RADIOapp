import 'package:flutter/material.dart';

/// NETWORX design tokens (dark-first, light-optional).
///
/// Keep token *names* aligned with web CSS variables where possible:
/// bg/surface/elevated/border/textPrimary/textSecondary/textMuted/primary/primaryHover/roseGold
class NetworxTokens {
  // 2026 Brand Palette — Neo‑Minimalist Noir
  // Primary background: Obsidian Night
  // Accent / action: Butterfly Electric
  // Text: Starlight White
  // Safety / mentor: Deep Cobalt
  // Web parity: background `#05070d`
  static const Color obsidianNight = Color(0xFF05070D);
  static const Color butterflyElectric = Color(0xFF00F5FF);
  static const Color butterflyElectricHover = Color(0xFF00C9D4);
  static const Color starlightWhite = Color(0xFFF5F5F5);
  static const Color deepCobalt = Color(0xFF1A237E);

  // Legacy brand tokens (kept to avoid broad refactors)
  static const Color amethyst = Color(0xFF6A0DAD);
  static const Color amethystGlow = Color(0xFF9B4DFF);
  // NOTE: roseGold now represents Deep Cobalt in the noir system.
  static const Color roseGold = deepCobalt;

  // Status
  static const Color success = Color(0xFF2ECC71);
  static const Color warning = Color(0xFFF2C94C);
  static const Color error = Color(0xFFEB5757);

  // Listener brand override (electric primary)
  static const Color listenerCyan = butterflyElectric;

  // Dark (primary)
  static const Color darkBg = obsidianNight;
  static const Color darkSurface = Color(0xFF0B0F18);
  static const Color darkElevated = Color(0xFF101726);
  static const Color darkBorder = Color(0x1AF5F5F5); // ~10% Starlight White

  static const Color darkTextPrimary = starlightWhite;
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
    obsidianNight,
    deepCobalt,
    butterflyElectric,
  ];
}

