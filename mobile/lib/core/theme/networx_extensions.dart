import 'dart:ui';
import 'package:flutter/material.dart';
import 'networx_tokens.dart';

/// Non-ColorScheme tokens that should stay consistent across the app.
///
/// This is the Flutter counterpart to web utilities like `.glass-panel`, `.bg-signature`,
/// `.badge-live`, and rose-gold spotlight glow.
@immutable
class NetworxSurfaces extends ThemeExtension<NetworxSurfaces> {
  final Color elevated;
  final Color border;
  final Color textSecondary;
  final Color textMuted;
  final Color primaryHover;
  final Color roseGold;
  final Color success;
  final Color warning;
  final Color error;

  /// Subtle “Collective” signature background gradient.
  final LinearGradient signatureGradient;

  /// Glass recipe for premium panels (player, spotlight cards, modals, headers).
  final double glassBlur;
  final double glassBgOpacity;
  final double glassBorderOpacity;
  final List<BoxShadow> glassShadow;

  const NetworxSurfaces({
    required this.elevated,
    required this.border,
    required this.textSecondary,
    required this.textMuted,
    required this.primaryHover,
    required this.roseGold,
    required this.success,
    required this.warning,
    required this.error,
    required this.signatureGradient,
    required this.glassBlur,
    required this.glassBgOpacity,
    required this.glassBorderOpacity,
    required this.glassShadow,
  });

  static NetworxSurfaces dark() {
    return NetworxSurfaces(
      elevated: NetworxTokens.darkElevated,
      border: NetworxTokens.darkBorder,
      textSecondary: NetworxTokens.darkTextSecondary,
      textMuted: NetworxTokens.darkTextMuted,
      primaryHover: NetworxTokens.butterflyElectricHover,
      roseGold: NetworxTokens.roseGold,
      success: NetworxTokens.success,
      warning: NetworxTokens.warning,
      error: NetworxTokens.error,
      signatureGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: NetworxTokens.signatureGradientStops,
        stops: const <double>[0, 0.45, 1],
      ),
      glassBlur: 16,
      glassBgOpacity: 0.10,
      glassBorderOpacity: 0.12,
      glassShadow: <BoxShadow>[
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.20),
          blurRadius: 32,
          offset: const Offset(0, 12),
        ),
        BoxShadow(
          color: NetworxTokens.electricCyan.withValues(alpha: 0.08),
          blurRadius: 24,
          offset: const Offset(0, 0),
        ),
      ],
    );
  }

  static NetworxSurfaces light() {
    return NetworxSurfaces(
      elevated: NetworxTokens.lightElevated,
      border: NetworxTokens.lightBorder,
      textSecondary: NetworxTokens.lightTextSecondary,
      textMuted: NetworxTokens.lightTextMuted,
      primaryHover: NetworxTokens.butterflyElectricHover,
      roseGold: NetworxTokens.roseGold,
      success: NetworxTokens.success,
      warning: NetworxTokens.warning,
      error: NetworxTokens.error,
      signatureGradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: const <Color>[
          NetworxTokens.lightBg,
          NetworxTokens.lightElevated,
          NetworxTokens.lightBorder,
        ],
        stops: const <double>[0, 0.6, 1],
      ),
      glassBlur: 12,
      glassBgOpacity: 0.70,
      glassBorderOpacity: 0.80,
      glassShadow: <BoxShadow>[
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.08),
          blurRadius: 32,
          offset: const Offset(0, 12),
        ),
      ],
    );
  }

  @override
  ThemeExtension<NetworxSurfaces> copyWith({
    Color? elevated,
    Color? border,
    Color? textSecondary,
    Color? textMuted,
    Color? primaryHover,
    Color? roseGold,
    Color? success,
    Color? warning,
    Color? error,
    LinearGradient? signatureGradient,
    double? glassBlur,
    double? glassBgOpacity,
    double? glassBorderOpacity,
    List<BoxShadow>? glassShadow,
  }) {
    return NetworxSurfaces(
      elevated: elevated ?? this.elevated,
      border: border ?? this.border,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      primaryHover: primaryHover ?? this.primaryHover,
      roseGold: roseGold ?? this.roseGold,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      error: error ?? this.error,
      signatureGradient: signatureGradient ?? this.signatureGradient,
      glassBlur: glassBlur ?? this.glassBlur,
      glassBgOpacity: glassBgOpacity ?? this.glassBgOpacity,
      glassBorderOpacity: glassBorderOpacity ?? this.glassBorderOpacity,
      glassShadow: glassShadow ?? this.glassShadow,
    );
  }

  @override
  ThemeExtension<NetworxSurfaces> lerp(
    covariant ThemeExtension<NetworxSurfaces>? other,
    double t,
  ) {
    if (other is! NetworxSurfaces) return this;

    Color lerpColor(Color a, Color b) => Color.lerp(a, b, t) ?? a;

    return NetworxSurfaces(
      elevated: lerpColor(elevated, other.elevated),
      border: lerpColor(border, other.border),
      textSecondary: lerpColor(textSecondary, other.textSecondary),
      textMuted: lerpColor(textMuted, other.textMuted),
      primaryHover: lerpColor(primaryHover, other.primaryHover),
      roseGold: lerpColor(roseGold, other.roseGold),
      success: lerpColor(success, other.success),
      warning: lerpColor(warning, other.warning),
      error: lerpColor(error, other.error),
      signatureGradient: LinearGradient.lerp(
            signatureGradient,
            other.signatureGradient,
            t,
          ) ??
          signatureGradient,
      glassBlur: lerpDouble(glassBlur, other.glassBlur, t) ?? glassBlur,
      glassBgOpacity:
          lerpDouble(glassBgOpacity, other.glassBgOpacity, t) ?? glassBgOpacity,
      glassBorderOpacity:
          lerpDouble(glassBorderOpacity, other.glassBorderOpacity, t) ??
              glassBorderOpacity,
      glassShadow: t < 0.5 ? glassShadow : other.glassShadow,
    );
  }
}

extension NetworxThemeX on BuildContext {
  NetworxSurfaces get networxSurfaces =>
      Theme.of(this).extension<NetworxSurfaces>() ??
      (Theme.of(this).brightness == Brightness.dark
          ? NetworxSurfaces.dark()
          : NetworxSurfaces.light());
}

