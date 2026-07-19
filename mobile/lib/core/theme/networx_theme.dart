import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dimension_theme.dart';
import 'dimension_tokens.dart';
import 'networx_extensions.dart';
import 'networx_tokens.dart';

enum NetworxBrand { listener, artist }

Color _brandPrimary(NetworxBrand brand) {
  switch (brand) {
    case NetworxBrand.listener:
      return NetworxTokens.electricCyan;
    case NetworxBrand.artist:
      return NetworxTokens.electricCyan;
  }
}

/// Build a NETWORX Material 3 ThemeData, dark-first.
///
/// Note: This keeps all surfaces/typography consistent, and only swaps the
/// brand primary for listener vs artist (web parity rule).
ThemeData buildNetworxTheme({
  required Brightness brightness,
  NetworxBrand brand = NetworxBrand.artist,
}) {
  final isDark = brightness == Brightness.dark;
  final primary = _brandPrimary(brand);

  final bg = isDark ? NetworxTokens.darkBg : NetworxTokens.lightBg;
  final surface = isDark ? NetworxTokens.darkSurface : NetworxTokens.lightSurface;
  final elevated =
      isDark ? NetworxTokens.darkElevated : NetworxTokens.lightElevated;
  final border = isDark ? NetworxTokens.darkBorder : NetworxTokens.lightBorder;

  final textPrimary =
      isDark ? NetworxTokens.darkTextPrimary : NetworxTokens.lightTextPrimary;
  final textSecondary = isDark
      ? NetworxTokens.darkTextSecondary
      : NetworxTokens.lightTextSecondary;
  final textMuted =
      isDark ? NetworxTokens.darkTextMuted : NetworxTokens.lightTextMuted;

  final scheme = ColorScheme(
    brightness: brightness,
    primary: primary,
    onPrimary: NetworxTokens.deepMidnight,
    primaryContainer: primary.withValues(alpha: isDark ? 0.20 : 0.14),
    onPrimaryContainer: textPrimary,
    secondary: NetworxTokens.deepCobalt,
    onSecondary: NetworxTokens.deepMidnight,
    secondaryContainer: NetworxTokens.deepCobalt.withValues(alpha: isDark ? 0.18 : 0.14),
    onSecondaryContainer: textPrimary,
    tertiary: NetworxTokens.butterflyElectricHover,
    onTertiary: NetworxTokens.deepMidnight,
    tertiaryContainer: NetworxTokens.butterflyElectricHover.withValues(alpha: isDark ? 0.16 : 0.12),
    onTertiaryContainer: textPrimary,
    error: NetworxTokens.error,
    onError: Colors.white,
    errorContainer: NetworxTokens.error.withValues(alpha: 0.15),
    onErrorContainer: textPrimary,
    surface: surface,
    onSurface: textPrimary,
    surfaceContainerHighest: elevated,
    onSurfaceVariant: textSecondary,
    outline: border,
    outlineVariant: border.withValues(alpha: isDark ? 0.85 : 1),
    shadow: Colors.black.withValues(alpha: isDark ? 0.30 : 0.10),
    scrim: Colors.black.withValues(alpha: 0.40),
    inverseSurface: isDark ? NetworxTokens.lightSurface : NetworxTokens.darkSurface,
    onInverseSurface: isDark ? NetworxTokens.lightTextPrimary : NetworxTokens.darkTextPrimary,
    inversePrimary: NetworxTokens.butterflyElectric,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    dividerColor: isDark ? Colors.white.withValues(alpha: 0.07) : border,
  );

  // Typography: Dimension / Emergent UI — Unbounded headings, Outfit body.
  final textTheme = GoogleFonts.outfitTextTheme(base.textTheme).apply(
    bodyColor: textPrimary,
    displayColor: textPrimary,
  );

  TextStyle? unbounded(TextStyle? style, {FontWeight weight = FontWeight.w800}) {
    if (style == null) return null;
    return GoogleFonts.unbounded(textStyle: style, fontWeight: weight);
  }

  final heading = textTheme.copyWith(
    displayLarge: unbounded(textTheme.displayLarge, weight: FontWeight.w900),
    displayMedium: unbounded(textTheme.displayMedium, weight: FontWeight.w900),
    displaySmall: unbounded(textTheme.displaySmall, weight: FontWeight.w800),
    headlineLarge: unbounded(textTheme.headlineLarge),
    headlineMedium: unbounded(textTheme.headlineMedium),
    headlineSmall: unbounded(textTheme.headlineSmall),
    titleLarge: unbounded(textTheme.titleLarge),
    titleMedium: unbounded(textTheme.titleMedium, weight: FontWeight.w700),
    titleSmall: unbounded(textTheme.titleSmall, weight: FontWeight.w700),
  );

  final dialogTitle = GoogleFonts.unbounded(
    fontSize: 20,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.3,
    color: textPrimary,
  );

  final surfaces = isDark ? NetworxSurfaces.dark() : NetworxSurfaces.light();

  return base.copyWith(
    textTheme: heading,
    appBarTheme: AppBarTheme(
      backgroundColor: surface,
      foregroundColor: textPrimary,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.unbounded(
        color: textPrimary,
        fontWeight: FontWeight.w700,
        fontSize: 20,
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      // Dark: translucent so the app-wide CyberBackdrop glow shows through
      // (glass feel without per-card blur). Light: keep opaque white surfaces.
      color: isDark ? surface.withValues(alpha: 0.62) : surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(DimensionTokens.cardRadius),
        side: BorderSide(color: border.withValues(alpha: isDark ? 0.9 : 1)),
      ),
    ),
    dividerTheme: DividerThemeData(
      // Soft hairline instead of a hard edge, to match the web's neon breaks.
      color: isDark ? Colors.white.withValues(alpha: 0.07) : border,
      thickness: 1,
      space: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark
          ? NetworxTokens.darkBg
          : NetworxTokens.lightSurface,
      labelStyle: TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: textMuted),
      helperStyle: TextStyle(color: textMuted),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: primary, width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: NetworxTokens.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: NetworxTokens.error, width: 2),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: elevated,
      contentTextStyle: TextStyle(color: textPrimary),
      actionTextColor: scheme.primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: primary.withValues(alpha: isDark ? 0.16 : 0.14),
      labelTextStyle: WidgetStatePropertyAll(
        heading.labelMedium?.copyWith(color: textSecondary),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return IconThemeData(color: primary);
        }
        return IconThemeData(color: textSecondary);
      }),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: scheme.primary.withValues(alpha: 0.12),
      labelStyle: TextStyle(color: textPrimary),
      side: BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: dialogTitle,
      contentTextStyle: heading.bodyMedium?.copyWith(color: textSecondary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    extensions: <ThemeExtension<dynamic>>[
      surfaces,
      DimensionTheme.dark(),
    ],
  );
}

