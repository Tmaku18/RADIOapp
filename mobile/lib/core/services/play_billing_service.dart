import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../env.dart';

class PlayPurchaseResult {
  final String productId;
  /// Google Play purchase token, or App Store StoreKit 2 JWS.
  final String purchaseToken;
  /// App Store transaction id (Flutter `PurchaseDetails.purchaseID`).
  final String? transactionId;

  const PlayPurchaseResult({
    required this.productId,
    required this.purchaseToken,
    this.transactionId,
  });
}

/// Storefront-independent consumable IAP helper (Google Play + App Store).
class PlayBillingService {
  PlayBillingService._();
  static final PlayBillingService instance = PlayBillingService._();

  final InAppPurchase _iap = InAppPurchase.instance;

  static const String _defaultCredits10 = 'nwx_credits_10';
  static const String _defaultCredits25 = 'nwx_credits_25';
  static const String _defaultCredits50 = 'nwx_credits_50';
  static const String _defaultCredits100 = 'nwx_credits_100';

  static const String _defaultSongPlays1 = 'nwx_song_plays_1';
  static const String _defaultSongPlays3 = 'nwx_song_plays_3';
  static const String _defaultSongPlays5 = 'nwx_song_plays_5';
  static const String _defaultSongPlays10 = 'nwx_song_plays_10';
  static const String _defaultSongPlays25 = 'nwx_song_plays_25';
  static const String _defaultSongPlays50 = 'nwx_song_plays_50';
  static const String _defaultSongPlays100 = 'nwx_song_plays_100';

  static const String defaultProNetworxMonthly = 'nwx_pro_networx_monthly';
  static const String _defaultTip199 = 'nwx_tip_199';
  static const String _defaultTip499 = 'nwx_tip_499';
  static const String _defaultTip999 = 'nwx_tip_999';
  static const String _defaultTip2499 = 'nwx_tip_2499';

  /// Tip tiers shown on mobile (custom free-text tips are web/Stripe only).
  static const List<int> tipAmountCentsOptions = [199, 499, 999, 2499];

  String get _storeLabel {
    if (Platform.isIOS) return 'App Store';
    if (Platform.isAndroid) return 'Google Play';
    return 'in-app purchases';
  }

  Set<String> get allKnownProductIds => {
        creditProductIdFor(10)!,
        creditProductIdFor(25)!,
        creditProductIdFor(50)!,
        creditProductIdFor(100)!,
        songPlaysProductIdFor(1)!,
        songPlaysProductIdFor(3)!,
        songPlaysProductIdFor(5)!,
        songPlaysProductIdFor(10)!,
        songPlaysProductIdFor(25)!,
        songPlaysProductIdFor(50)!,
        songPlaysProductIdFor(100)!,
        proNetworxMonthlyProductId,
        tipProductIdForCents(199)!,
        tipProductIdForCents(499)!,
        tipProductIdForCents(999)!,
        tipProductIdForCents(2499)!,
      };

  String? _envOrDefault(String key, String fallback) {
    return env(key) ?? fallback;
  }

  String? creditProductIdFor(int credits) {
    switch (credits) {
      case 10:
        return _envOrDefault(
              'IOS_APP_STORE_CREDITS_10_PRODUCT_ID',
              env('ANDROID_PLAY_CREDITS_10_PRODUCT_ID') ?? _defaultCredits10,
            );
      case 25:
        return _envOrDefault(
              'IOS_APP_STORE_CREDITS_25_PRODUCT_ID',
              env('ANDROID_PLAY_CREDITS_25_PRODUCT_ID') ?? _defaultCredits25,
            );
      case 50:
        return _envOrDefault(
              'IOS_APP_STORE_CREDITS_50_PRODUCT_ID',
              env('ANDROID_PLAY_CREDITS_50_PRODUCT_ID') ?? _defaultCredits50,
            );
      case 100:
        return _envOrDefault(
              'IOS_APP_STORE_CREDITS_100_PRODUCT_ID',
              env('ANDROID_PLAY_CREDITS_100_PRODUCT_ID') ?? _defaultCredits100,
            );
      default:
        return null;
    }
  }

  String? songPlaysProductIdFor(int plays) {
    switch (plays) {
      case 1:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_1_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_1_PRODUCT_ID') ?? _defaultSongPlays1,
            );
      case 3:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_3_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_3_PRODUCT_ID') ?? _defaultSongPlays3,
            );
      case 5:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_5_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_5_PRODUCT_ID') ?? _defaultSongPlays5,
            );
      case 10:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_10_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_10_PRODUCT_ID') ??
                  _defaultSongPlays10,
            );
      case 25:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_25_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_25_PRODUCT_ID') ??
                  _defaultSongPlays25,
            );
      case 50:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_50_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_50_PRODUCT_ID') ??
                  _defaultSongPlays50,
            );
      case 100:
        return _envOrDefault(
              'IOS_APP_STORE_SONG_PLAYS_100_PRODUCT_ID',
              env('ANDROID_PLAY_SONG_PLAYS_100_PRODUCT_ID') ??
                  _defaultSongPlays100,
            );
      default:
        return null;
    }
  }

  String get proNetworxMonthlyProductId =>
      _envOrDefault(
        'IOS_APP_STORE_PRO_NETWORX_MONTHLY_PRODUCT_ID',
        env('ANDROID_PLAY_PRO_NETWORX_MONTHLY_PRODUCT_ID') ??
            defaultProNetworxMonthly,
      )!;

  String? tipProductIdForCents(int amountCents) {
    switch (amountCents) {
      case 199:
        return _envOrDefault(
          'IOS_APP_STORE_TIP_199_PRODUCT_ID',
          env('ANDROID_PLAY_TIP_199_PRODUCT_ID') ?? _defaultTip199,
        );
      case 499:
        return _envOrDefault(
          'IOS_APP_STORE_TIP_499_PRODUCT_ID',
          env('ANDROID_PLAY_TIP_499_PRODUCT_ID') ?? _defaultTip499,
        );
      case 999:
        return _envOrDefault(
          'IOS_APP_STORE_TIP_999_PRODUCT_ID',
          env('ANDROID_PLAY_TIP_999_PRODUCT_ID') ?? _defaultTip999,
        );
      case 2499:
        return _envOrDefault(
          'IOS_APP_STORE_TIP_2499_PRODUCT_ID',
          env('ANDROID_PLAY_TIP_2499_PRODUCT_ID') ?? _defaultTip2499,
        );
      default:
        return null;
    }
  }

  /// Dynamic song-play product mapping by `(plays, totalCents)` key.
  ///
  /// Prefers `IOS_APP_STORE_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON` on iOS, then
  /// `ANDROID_PLAY_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON`.
  ///
  /// Key format: `plays:totalCents` (example: `5:995`)
  String? songPlaysProductIdForPricing({
    required int plays,
    required int totalCents,
  }) {
    final candidates = <String?>[
      if (Platform.isIOS) env('IOS_APP_STORE_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON'),
      env('ANDROID_PLAY_SONG_PLAYS_PRICE_PRODUCT_MAP_JSON'),
    ];
    for (final raw in candidates) {
      if (raw == null || raw.isEmpty) continue;
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          final dynamic id = decoded['$plays:$totalCents'];
          if (id is String && id.isNotEmpty) return id;
        }
      } catch (e) {
        debugPrint('Invalid IAP song-plays price product map JSON: $e');
      }
    }
    return songPlaysProductIdFor(plays);
  }

  Future<bool> isAvailable() async {
    return _iap.isAvailable();
  }

  Future<ProductDetails> getProductDetails(String productId) async {
    final response = await _iap.queryProductDetails({productId});
    if (response.error != null) {
      throw Exception(
        response.error?.message ?? 'Failed to load $_storeLabel product',
      );
    }
    if (response.notFoundIDs.contains(productId) ||
        response.productDetails.isEmpty) {
      throw Exception(
        'Product $productId not found in $_storeLabel for this app build.',
      );
    }
    return response.productDetails.first;
  }

  Future<PlayPurchaseResult> buyConsumable(String productId) async {
    return _buy(
      productId: productId,
      startPurchase: (product) => _iap.buyConsumable(
        purchaseParam: PurchaseParam(productDetails: product),
      ),
    );
  }

  /// Auto-renewable / non-consumable subscription purchase (Pro-Networx).
  Future<PlayPurchaseResult> buySubscription(String productId) async {
    return _buy(
      productId: productId,
      startPurchase: (product) => _iap.buyNonConsumable(
        purchaseParam: PurchaseParam(productDetails: product),
      ),
    );
  }

  /// Restore prior Pro-Networx subscription purchases from the store.
  Future<PlayPurchaseResult?> restoreSubscription(String productId) async {
    final available = await isAvailable();
    if (!available) {
      throw Exception('$_storeLabel Billing is not available on this device.');
    }

    final completer = Completer<PlayPurchaseResult?>();
    late final StreamSubscription<List<PurchaseDetails>> subscription;
    subscription = _iap.purchaseStream.listen(
      (updates) async {
        for (final purchase in updates) {
          if (purchase.productID != productId) continue;
          if (purchase.status == PurchaseStatus.error) {
            await _finishPurchaseIfNeeded(purchase);
            if (!completer.isCompleted) {
              completer.completeError(
                Exception(
                  purchase.error?.message ?? '$_storeLabel restore failed.',
                ),
              );
            }
            continue;
          }
          if (purchase.status == PurchaseStatus.restored ||
              purchase.status == PurchaseStatus.purchased) {
            await _finishPurchaseIfNeeded(purchase);
            final token = purchase.verificationData.serverVerificationData;
            if (!completer.isCompleted) {
              completer.complete(
                PlayPurchaseResult(
                  productId: productId,
                  purchaseToken: token,
                  transactionId: purchase.purchaseID,
                ),
              );
            }
          }
        }
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!completer.isCompleted) {
          completer.completeError(error, stackTrace);
        }
      },
    );

    try {
      await _iap.restorePurchases();
      final result = await completer.future.timeout(
        const Duration(seconds: 45),
        onTimeout: () => null,
      );
      return result;
    } finally {
      await subscription.cancel();
    }
  }

  Future<PlayPurchaseResult> _buy({
    required String productId,
    required Future<bool> Function(ProductDetails product) startPurchase,
  }) async {
    final available = await isAvailable();
    if (!available) {
      throw Exception('$_storeLabel Billing is not available on this device.');
    }

    final product = await getProductDetails(productId);
    final completer = Completer<PlayPurchaseResult>();
    late final StreamSubscription<List<PurchaseDetails>> subscription;
    subscription = _iap.purchaseStream.listen(
      (updates) async {
        for (final purchase in updates) {
          if (purchase.productID != productId) continue;

          if (purchase.status == PurchaseStatus.canceled) {
            await _finishPurchaseIfNeeded(purchase);
            if (!completer.isCompleted) {
              completer.completeError(Exception('Purchase was cancelled.'));
            }
            continue;
          }

          if (purchase.status == PurchaseStatus.error) {
            await _finishPurchaseIfNeeded(purchase);
            final message =
                purchase.error?.message ?? '$_storeLabel purchase failed.';
            if (!completer.isCompleted) {
              completer.completeError(Exception(message));
            }
            continue;
          }

          if (purchase.status == PurchaseStatus.purchased ||
              purchase.status == PurchaseStatus.restored) {
            await _finishPurchaseIfNeeded(purchase);
            final token = purchase.verificationData.serverVerificationData;
            if (token.isEmpty &&
                (purchase.purchaseID == null || purchase.purchaseID!.isEmpty)) {
              if (!completer.isCompleted) {
                completer.completeError(
                  Exception(
                    'Missing verification data from $_storeLabel purchase.',
                  ),
                );
              }
            } else if (!completer.isCompleted) {
              completer.complete(
                PlayPurchaseResult(
                  productId: productId,
                  purchaseToken: token,
                  transactionId: purchase.purchaseID,
                ),
              );
            }
          }
        }
      },
      onError: (Object error, StackTrace stackTrace) {
        if (!completer.isCompleted) {
          completer.completeError(error, stackTrace);
        }
      },
    );

    try {
      final started = await startPurchase(product);
      if (!started) {
        throw Exception(
          '$_storeLabel did not start purchase flow for $productId.',
        );
      }
      final result = await completer.future.timeout(
        const Duration(minutes: 2),
        onTimeout: () {
          throw Exception('Purchase timed out. Please try again.');
        },
      );
      return result;
    } finally {
      await subscription.cancel();
    }
  }

  Future<void> _finishPurchaseIfNeeded(PurchaseDetails purchase) async {
    if (!purchase.pendingCompletePurchase) return;
    try {
      await _iap.completePurchase(purchase);
    } catch (e) {
      debugPrint('completePurchase failed: $e');
    }
  }
}
