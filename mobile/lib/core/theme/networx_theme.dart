import 'package:flutter/material.dart';
import 'networx_extensions.dart';
import 'networx_tokens.dart';

enum NetworxBrand { listener, artist }

Color _brandPrimary(NetworxBrand brand) {
  switch (brand) {
    case NetworxBrand.listener:
      return NetworxTokens.butterflyElectric;
    case NetworxBrand.artist:
      return NetworxTokens.butterflyElectric;
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
    onPrimary: NetworxTokens.obsidianNight,
    primaryContainer: primary.withValues(alpha: isDark ? 0.20 : 0.14),
    onPrimaryContainer: textPrimary,
    secondary: NetworxTokens.deepCobalt,
    onSecondary: NetworxTokens.starlightWhite,
    secondaryContainer: NetworxTokens.deepCobalt.withValues(alpha: isDark ? 0.18 : 0.14),
    onSecondaryContainer: textPrimary,
    tertiary: NetworxTokens.butterflyElectricHover,
    onTertiary: NetworxTokens.obsidianNight,
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
    dividerColor: border,
  );

  // Typography: keep serif as “premium spice” via explicit styles. We wire
  // font families later when assets are present; missing families fall back safely.
  const fontSans = 'Inter';
  const fontHeading = 'SpaceGrotesk';
  const fontSerif = 'Lora';

  final textTheme = base.textTheme.apply(
    fontFamily: fontSans,
    bodyColor: textPrimary,
    displayColor: textPrimary,
  );

  final heading = textTheme.copyWith(
    headlineLarge: textTheme.headlineLarge?.copyWith(fontFamily: fontHeading),
    headlineMedium: textTheme.headlineMedium?.copyWith(fontFamily: fontHeading),
    headlineSmall: textTheme.headlineSmall?.copyWith(fontFamily: fontHeading),
    titleLarge: textTheme.titleLarge?.copyWith(fontFamily: fontHeading),
    titleMedium: textTheme.titleMedium?.copyWith(fontFamily: fontHeading),
    titleSmall: textTheme.titleSmall?.copyWith(fontFamily: fontHeading),
  );

  // Serif “signature” style used for hero/spotlight titles.
  final serifTitle = heading.displaySmall?.copyWith(
    fontFamily: fontSerif,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );

  final surfaces = isDark ? NetworxSurfaces.dark() : NetworxSurfaces.light();

  return base.copyWith(
    textTheme: heading,
    appBarTheme: AppBarTheme(
      backgroundColor: surface,
      foregroundColor: textPrimary,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: heading.titleLarge?.copyWith(
        color: textPrimary,
        fontFamily: fontHeading,
        fontWeight: FontWeight.w600,
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: border.withValues(alpha: isDark ? 0.9 : 1)),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: border,
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
      titleTextStyle: serifTitle?.copyWith(color: textPrimary),
      contentTextStyle: heading.bodyMedium?.copyWith(color: textSecondary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    extensions: <ThemeExtension<dynamic>>[
      surfaces,
    ],
  );
}

