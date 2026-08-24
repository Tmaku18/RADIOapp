import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../constants/song_price_tiers.dart';
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

  /// Lazy so unit tests can call [describeStoreError] without binding IAP.
  InAppPurchase get _iap => InAppPurchase.instance;

  /// Guards [_buy] so overlapping purchases can't consume each other's updates.
  bool _purchaseInFlight = false;

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
  static const String defaultProRadioMonthly = 'nwx_pro_radio_monthly';
  static const String defaultProBundleMonthly = 'nwx_pro_bundle_monthly';
  static const String defaultRefinerySubmission = 'nwx_refinery_submission';
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
        proRadioMonthlyProductId,
        proBundleMonthlyProductId,
        refinerySubmissionProductId,
        tipProductIdForCents(199)!,
        tipProductIdForCents(499)!,
        tipProductIdForCents(999)!,
        tipProductIdForCents(2499)!,
        for (final cents in kSongPriceTiersCents)
          songPurchaseProductIdForCents(cents),
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

  String get proRadioMonthlyProductId =>
      _envOrDefault(
        'IOS_APP_STORE_PRO_RADIO_MONTHLY_PRODUCT_ID',
        env('ANDROID_PLAY_PRO_RADIO_MONTHLY_PRODUCT_ID') ??
            defaultProRadioMonthly,
      )!;

  String get proBundleMonthlyProductId =>
      _envOrDefault(
        'IOS_APP_STORE_PRO_BUNDLE_MONTHLY_PRODUCT_ID',
        env('ANDROID_PLAY_PRO_BUNDLE_MONTHLY_PRODUCT_ID') ??
            defaultProBundleMonthly,
      )!;

  String get refinerySubmissionProductId =>
      _envOrDefault(
        'IOS_APP_STORE_REFINERY_SUBMISSION_PRODUCT_ID',
        env('ANDROID_PLAY_REFINERY_SUBMISSION_PRODUCT_ID') ??
            defaultRefinerySubmission,
      )!;

  /// Consumable SKU that sells a song or beat priced at [priceCents].
  ///
  /// One SKU is shared by every song at that price, so it must be a consumable
  /// — a non-consumable could only be bought once per account. Ownership is
  /// tracked server-side in `song_purchases`. [priceCents] is snapped onto
  /// [kSongPriceTiersCents] first so any artist price resolves to a registered
  /// product.
  String songPurchaseProductIdForCents(int priceCents) {
    final suffix = snapToSongPriceTier(
      priceCents,
    ).toString().padLeft(3, '0');
    return _envOrDefault(
      'IOS_APP_STORE_SONG_PURCHASE_${suffix}_PRODUCT_ID',
      env('ANDROID_PLAY_SONG_PURCHASE_${suffix}_PRODUCT_ID') ??
          'nwx_song_$suffix',
    )!;
  }

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

  /// True when the buyer simply backed out of the store sheet, which should
  /// never be surfaced as a failed payment.
  bool isPurchaseCancellation(Object error) {
    final raw = error is PlatformException
        ? '${error.code} ${error.message ?? ''}'
        : error.toString();
    final lower = raw.toLowerCase();
    return lower.contains('cancel');
  }

  /// Maps StoreKit / Play Billing failures into actionable copy.
  String describeStoreError(Object error, {String? productId}) {
    final raw = error is PlatformException
        ? (error.message ?? error.code)
        : error.toString();
    final lower = raw.toLowerCase();
    final sku = productId ?? 'this product';

    if (lower.contains('storekit_no_response') ||
        lower.contains('failed to get response from platform')) {
      // Store-configuration detail is for us, not for the buyer.
      debugPrint(
        'Store did not respond for $sku. Check: Paid Apps Agreement active, '
        'product $sku exists with a localization, signed into a Sandbox Apple '
        'ID (Settings → Developer), and the product has finished propagating.',
      );
      return 'Purchases are temporarily unavailable. '
          'Please try again in a moment.';
    }
    if (lower.contains('not found') || lower.contains('notfound')) {
      debugPrint(
        'Product $sku missing from $_storeLabel for this build — confirm the '
        'Product ID matches App Store Connect / Play Console and is for sale.',
      );
      return 'This purchase isn’t available yet. Please try again later.';
    }
    if (lower.contains('billing is not available') ||
        lower.contains('canmakepayments') ||
        lower.contains('not available')) {
      return '$_storeLabel purchases are not available on this device '
          '(Restrictions / Screen Time may be blocking In-App Purchases).';
    }
    // Strip redundant Exception: prefixes from nested throws.
    return raw.replaceFirst(RegExp(r'^(Exception:\s*)+'), '');
  }

  Future<ProductDetails> getProductDetails(String productId) async {
    Object? lastError;

    // StoreKit sometimes returns empty on the first cold query after launch.
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await Future<void>.delayed(Duration(milliseconds: 400 * attempt));
      }
      try {
        final response = await _iap.queryProductDetails({productId});
        if (response.productDetails.isNotEmpty &&
            !response.notFoundIDs.contains(productId)) {
          return response.productDetails.firstWhere(
            (p) => p.id == productId,
            orElse: () => response.productDetails.first,
          );
        }
        if (response.error != null) {
          final err = response.error!;
          lastError = Exception(err.message.isNotEmpty ? err.message : err.code);
          final code = err.code.toLowerCase();
          final msg = err.message.toLowerCase();
          final retryable = code.contains('storekit_no_response') ||
              msg.contains('failed to get response from platform');
          if (!retryable) break;
          continue;
        }
        lastError = Exception(
          'Product $productId not found in $_storeLabel for this app build.',
        );
      } on PlatformException catch (e) {
        lastError = e;
        final retryable = e.code.toLowerCase().contains('storekit_no_response') ||
            (e.message ?? '')
                .toLowerCase()
                .contains('failed to get response from platform');
        if (!retryable) break;
      } catch (e) {
        lastError = e;
        break;
      }
    }

    throw Exception(
      describeStoreError(
        lastError ??
            Exception('Failed to load $_storeLabel product $productId'),
        productId: productId,
      ),
    );
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
      // Callers probe several SKUs in sequence, so a long per-product wait adds
      // up to minutes of spinner for someone with nothing to restore.
      final result = await completer.future.timeout(
        const Duration(seconds: 12),
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
    // Songs at the same price share one consumable SKU and purchaseStream only
    // identifies updates by product id, so two overlapping buys could resolve
    // against each other's transaction. One purchase at a time.
    if (_purchaseInFlight) {
      throw Exception(
        'Another purchase is still finishing. Please wait for it to complete.',
      );
    }
    _purchaseInFlight = true;
    try {
      final available = await isAvailable();
      if (!available) {
        throw Exception(
          '$_storeLabel Billing is not available on this device.',
        );
      }

      final product = await getProductDetails(productId);
      final completer = Completer<PlayPurchaseResult>();
      late final StreamSubscription<List<PurchaseDetails>> subscription;
      // Listen before starting purchase — StoreKit can emit updates immediately.
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
              final message = describeStoreError(
                purchase.error?.message ?? '$_storeLabel purchase failed.',
                productId: productId,
              );
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
                  (purchase.purchaseID == null ||
                      purchase.purchaseID!.isEmpty)) {
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
            completer.completeError(
              Exception(describeStoreError(error, productId: productId)),
              stackTrace,
            );
          }
        },
      );

      try {
        // Yield so the purchaseStream onListen hooks (StoreKit listeners) attach.
        await Future<void>.delayed(Duration.zero);
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
    } catch (e) {
      throw Exception(describeStoreError(e, productId: productId));
    } finally {
      _purchaseInFlight = false;
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
