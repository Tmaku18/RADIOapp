import 'package:flutter/material.dart';
import 'dimension_theme.dart';
import 'dimension_tokens.dart';
import 'networx_extensions.dart';
import 'networx_tokens.dart';

enum NetworxBrand { listener, artist }

/// Single UI family for the whole app. Inter is bundled in `pubspec.yaml`, so
/// it renders offline and on first launch — and it tracks closely enough to
/// the system UI font that native controls sit comfortably beside it.
const String kNetworxFontFamily = 'Inter';

Color _brandPrimary(NetworxBrand brand, {required bool isDark}) {
  if (!isDark) return NetworxTokens.lightPrimary;
  switch (brand) {
    case NetworxBrand.listener:
      return NetworxTokens.electricCyan;
    case NetworxBrand.artist:
      return NetworxTokens.electricCyan;
  }
}

/// Build a NETWORX Material 3 ThemeData, dark-first.
///
/// The look is deliberately quiet: flat surfaces, hairline separators, one
/// accent, and a tight type scale. Artwork should be the loudest thing on any
/// screen.
ThemeData buildNetworxTheme({
  required Brightness brightness,
  NetworxBrand brand = NetworxBrand.artist,
}) {
  final isDark = brightness == Brightness.dark;
  // Keep Dimension static getters aligned even before MaterialApp.builder runs.
  DimensionTokens.bindBrightness(brightness);
  final primary = _brandPrimary(brand, isDark: isDark);

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
    onPrimary: Colors.white,
    primaryContainer: primary.withValues(alpha: isDark ? 0.20 : 0.12),
    onPrimaryContainer: textPrimary,
    secondary: primary,
    onSecondary: Colors.white,
    secondaryContainer: primary.withValues(alpha: isDark ? 0.16 : 0.10),
    onSecondaryContainer: textPrimary,
    tertiary: primary,
    onTertiary: Colors.white,
    tertiaryContainer: primary.withValues(alpha: isDark ? 0.14 : 0.10),
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
    shadow: Colors.black.withValues(alpha: isDark ? 0.40 : 0.10),
    scrim: Colors.black.withValues(alpha: 0.40),
    inverseSurface: isDark ? NetworxTokens.lightSurface : NetworxTokens.darkSurface,
    onInverseSurface: isDark ? NetworxTokens.lightTextPrimary : NetworxTokens.darkTextPrimary,
    inversePrimary: primary,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    fontFamily: kNetworxFontFamily,
    scaffoldBackgroundColor: bg,
    dividerColor: border,
  );

  // A compact, system-like scale. Headings get weight and negative tracking
  // rather than a second display face.
  TextStyle t(double size, FontWeight weight, {double tracking = 0, double? height}) {
    return TextStyle(
      fontFamily: kNetworxFontFamily,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: tracking,
      height: height,
      color: textPrimary,
    );
  }

  final textTheme = TextTheme(
    displayLarge: t(34, FontWeight.w700, tracking: -0.7, height: 1.1),
    displayMedium: t(28, FontWeight.w700, tracking: -0.6, height: 1.15),
    displaySmall: t(24, FontWeight.w700, tracking: -0.5, height: 1.2),
    headlineLarge: t(22, FontWeight.w700, tracking: -0.4, height: 1.2),
    headlineMedium: t(20, FontWeight.w700, tracking: -0.4, height: 1.25),
    headlineSmall: t(18, FontWeight.w600, tracking: -0.3, height: 1.3),
    titleLarge: t(17, FontWeight.w600, tracking: -0.3),
    titleMedium: t(16, FontWeight.w600, tracking: -0.2),
    titleSmall: t(15, FontWeight.w600, tracking: -0.1),
    bodyLarge: t(17, FontWeight.w400, height: 1.4),
    bodyMedium: t(15, FontWeight.w400, height: 1.45),
    bodySmall: t(13, FontWeight.w400, height: 1.4).copyWith(color: textSecondary),
    labelLarge: t(15, FontWeight.w600),
    labelMedium: t(13, FontWeight.w500).copyWith(color: textSecondary),
    labelSmall: t(12, FontWeight.w500).copyWith(color: textMuted),
  );

  final surfaces = isDark ? NetworxSurfaces.dark() : NetworxSurfaces.light();

  return base.copyWith(
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: t(20, FontWeight.w700, tracking: -0.4),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(DimensionTokens.cardRadius),
        side: BorderSide(color: border),
      ),
    ),
    listTileTheme: ListTileThemeData(
      iconColor: textSecondary,
      textColor: textPrimary,
      titleTextStyle: textTheme.titleSmall,
      subtitleTextStyle: textTheme.bodySmall,
      minVerticalPadding: 10,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(DimensionTokens.tileRadius),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: border,
      thickness: 0.5,
      space: 0.5,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? NetworxTokens.darkSurface : NetworxTokens.lightElevated,
      labelStyle: TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: textMuted),
      helperStyle: TextStyle(color: textMuted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: NetworxTokens.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: NetworxTokens.error, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        textStyle: t(15, FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        textStyle: t(15, FontWeight.w600),
        foregroundColor: textPrimary,
        side: BorderSide(color: border),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        textStyle: t(15, FontWeight.w600),
        foregroundColor: primary,
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: elevated,
      contentTextStyle: TextStyle(
        color: textPrimary,
        fontFamily: kNetworxFontFamily,
      ),
      actionTextColor: scheme.primary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    // iOS-style segmented control: a neutral track with a lighter selected
    // "thumb". Left to Material's defaults the selected segment picked up a
    // translucent accent fill that muddied to dark red over black.
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return isDark ? const Color(0xFF48484A) : Colors.white;
          }
          return isDark ? const Color(0xFF1C1C1E) : const Color(0xFFEFEFF4);
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? textPrimary
              : textSecondary;
        }),
        textStyle: WidgetStatePropertyAll(t(14, FontWeight.w600)),
        side: const WidgetStatePropertyAll(BorderSide.none),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: textPrimary,
      unselectedLabelColor: textSecondary,
      labelStyle: t(15, FontWeight.w600),
      unselectedLabelStyle: t(15, FontWeight.w500),
      indicatorColor: primary,
      indicatorSize: TabBarIndicatorSize.label,
      dividerColor: Colors.transparent,
    ),
    sliderTheme: SliderThemeData(
      trackHeight: 4,
      activeTrackColor: textPrimary.withValues(alpha: 0.9),
      inactiveTrackColor: textPrimary.withValues(alpha: 0.18),
      thumbColor: textPrimary,
      overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      elevation: 0,
      indicatorColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return t(10, selected ? FontWeight.w600 : FontWeight.w500)
            .copyWith(color: selected ? primary : textSecondary);
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return IconThemeData(color: primary, size: 24);
        }
        return IconThemeData(color: textSecondary, size: 24);
      }),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: elevated,
      labelStyle: TextStyle(
        color: textPrimary,
        fontFamily: kNetworxFontFamily,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
      side: BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: isDark ? NetworxTokens.darkSurface : NetworxTokens.lightBg,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: isDark ? NetworxTokens.darkElevated : NetworxTokens.lightBg,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: t(18, FontWeight.w700, tracking: -0.3),
      contentTextStyle: textTheme.bodyMedium?.copyWith(color: textSecondary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    extensions: <ThemeExtension<dynamic>>[
      surfaces,
      isDark ? DimensionTheme.dark() : DimensionTheme.light(),
    ],
  );
}
