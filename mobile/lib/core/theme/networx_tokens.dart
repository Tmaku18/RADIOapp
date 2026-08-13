import 'package:flutter/material.dart';

/// NETWORX brand tokens (dark-first, light-optional).
///
/// The palette is deliberately narrow — near-black or white surfaces, greys
/// for structure, and a single red accent — so album artwork carries the
/// colour in the UI. Token *names* are historical; several "cyan"/"gold"
/// names now resolve to that one accent so older call sites stay consistent
/// instead of reintroducing a second brand colour.
class NetworxTokens {
  // Core surfaces
  static const Color deepMidnight = Color(0xFF000000);
  static const Color charcoalMatte = Color(0xFF1C1C1E);

  /// The single brand accent (historically "electric cyan").
  static const Color electricCyan = Color(0xFFFA243C);
  static const Color electricCyanHover = Color(0xFFD91E33);
  static const Color deepCobalt = Color(0xFFFA243C);
  static const Color cloudDancer = Color(0xFFFFFFFF);

  // Back-compat aliases (avoid broad refactors)
  static const Color obsidianNight = deepMidnight;
  static const Color butterflyElectric = electricCyan;
  static const Color butterflyElectricHover = electricCyanHover;
  static const Color starlightWhite = cloudDancer;
  static const Color radioactiveLime = Color(0xFF30D158);

  // Legacy brand tokens (kept to avoid broad refactors)
  static const Color amethyst = Color(0xFFFA243C);
  static const Color amethystGlow = Color(0xFFFF5A6E);
  static const Color roseGold = electricCyan;

  // Status — system-style, used sparingly
  static const Color success = Color(0xFF30D158);
  static const Color warning = Color(0xFFFFD60A);
  static const Color error = Color(0xFFFF453A);

  // Listener brand override
  static const Color listenerCyan = butterflyElectric;

  // Dark (primary)
  static const Color darkBg = deepMidnight;
  static const Color darkSurface = charcoalMatte;
  static const Color darkElevated = Color(0xFF2C2C2E);
  static const Color darkBorder = Color(0x17FFFFFF); // ~9% white hairline

  static const Color darkTextPrimary = cloudDancer;
  static const Color darkTextSecondary = Color(0xFF9E9EA7);
  static const Color darkTextMuted = Color(0xFF6C6C72);

  // Light
  static const Color lightBg = Color(0xFFFFFFFF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightElevated = Color(0xFFF2F2F7);
  static const Color lightBorder = Color(0x14000000); // ~8% black hairline

  static const Color lightTextPrimary = Color(0xFF000000);
  static const Color lightTextSecondary = Color(0xFF6B6B70);
  static const Color lightTextMuted = Color(0xFF8A8A8E);

  static const Color lightPrimary = Color(0xFFD70015);
  static const Color lightPrimaryHover = Color(0xFFB00010);

  /// Neutral wash used behind hero areas. Kept low-contrast so it reads as
  /// depth rather than decoration.
  static const List<Color> signatureGradientStops = <Color>[
    Color(0xFF1C1C1E),
    Color(0xFF121214),
    Color(0xFF000000),
  ];
}
