import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'payments_service.dart';

/// A store purchase the buyer has already paid for but the backend has not
/// redeemed yet.
///
/// The store considers the transaction finished as soon as it is acknowledged,
/// so if the `complete` call fails (offline, expired token, backend down) the
/// purchase would otherwise be lost with the money taken. Entries live in
/// SharedPreferences until the backend confirms them.
class PendingStorePurchase {
  const PendingStorePurchase({
    required this.productId,
    required this.purchaseToken,
    required this.appStore,
    required this.createdAtMs,
    this.transactionId,
    this.songId,
    this.sessionId,
    this.customQuestions,
  });

  final String productId;
  final String purchaseToken;

  /// True for App Store (StoreKit JWS), false for Google Play.
  final bool appStore;
  final int createdAtMs;
  final String? transactionId;
  final String? songId;
  final String? sessionId;
  final List<String>? customQuestions;

  /// Stable identity so the same purchase is never queued twice.
  String get id => '$productId|${transactionId ?? purchaseToken}';

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'purchaseToken': purchaseToken,
        'appStore': appStore,
        'createdAtMs': createdAtMs,
        if (transactionId != null) 'transactionId': transactionId,
        if (songId != null) 'songId': songId,
        if (sessionId != null) 'sessionId': sessionId,
        if (customQuestions != null) 'customQuestions': customQuestions,
      };

  static PendingStorePurchase? fromJson(Map<String, dynamic> json) {
    final productId = json['productId']?.toString();
    final token = json['purchaseToken']?.toString();
    if (productId == null || productId.isEmpty || token == null) return null;
    final questions = json['customQuestions'];
    return PendingStorePurchase(
      productId: productId,
      purchaseToken: token,
      appStore: json['appStore'] == true,
      createdAtMs: (json['createdAtMs'] as num?)?.toInt() ?? 0,
      transactionId: json['transactionId']?.toString(),
      songId: json['songId']?.toString(),
      sessionId: json['sessionId']?.toString(),
      customQuestions: questions is List
          ? questions.map((e) => e.toString()).toList()
          : null,
    );
  }
}

/// Persists paid-but-unredeemed store purchases and retries them later.
class PendingPurchaseQueue {
  PendingPurchaseQueue._();
  static final PendingPurchaseQueue instance = PendingPurchaseQueue._();

  static const String _key = 'pending_store_purchases_v1';

  /// Past this age a token is almost certainly unredeemable; keeping it would
  /// only make every launch retry forever.
  static const Duration _maxAge = Duration(days: 30);

  bool _draining = false;

  Future<List<PendingStorePurchase>> all() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_key) ?? const <String>[];
    final out = <PendingStorePurchase>[];
    for (final entry in raw) {
      try {
        final decoded = jsonDecode(entry);
        if (decoded is Map<String, dynamic>) {
          final parsed = PendingStorePurchase.fromJson(decoded);
          if (parsed != null) out.add(parsed);
        }
      } catch (_) {
        // Drop unreadable entries rather than blocking the queue.
      }
    }
    return out;
  }

  Future<void> add(PendingStorePurchase purchase) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = await all();
    if (existing.any((p) => p.id == purchase.id)) return;
    final next = [...existing, purchase];
    await prefs.setStringList(
      _key,
      next.map((p) => jsonEncode(p.toJson())).toList(),
    );
  }

  Future<void> remove(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final next = (await all()).where((p) => p.id != id).toList();
    await prefs.setStringList(
      _key,
      next.map((p) => jsonEncode(p.toJson())).toList(),
    );
  }

  /// Replays every queued purchase against the backend. Safe to call often —
  /// the backend dedupes on the store transaction id, and entries are only
  /// dropped once it confirms (or they age out).
  Future<void> drain(PaymentsService payments) async {
    if (_draining) return;
    _draining = true;
    try {
      final pending = await all();
      if (pending.isEmpty) return;
      final nowMs = DateTime.now().millisecondsSinceEpoch;

      for (final purchase in pending) {
        if (purchase.createdAtMs > 0 &&
            nowMs - purchase.createdAtMs > _maxAge.inMilliseconds) {
          debugPrint('Dropping stale pending purchase ${purchase.id}');
          await remove(purchase.id);
          continue;
        }
        try {
          if (purchase.appStore) {
            await payments.completeAppStorePurchase(
              productId: purchase.productId,
              signedTransaction: purchase.purchaseToken,
              transactionId: purchase.transactionId,
              songId: purchase.songId,
              sessionId: purchase.sessionId,
              customQuestions: purchase.customQuestions,
            );
          } else {
            await payments.completeGooglePlayPurchase(
              productId: purchase.productId,
              purchaseToken: purchase.purchaseToken,
              songId: purchase.songId,
              sessionId: purchase.sessionId,
              customQuestions: purchase.customQuestions,
            );
          }
          await remove(purchase.id);
          debugPrint('Redeemed queued purchase ${purchase.id}');
        } catch (e) {
          // Keep it for the next attempt (not signed in yet, offline, 5xx).
          debugPrint('Pending purchase ${purchase.id} still unredeemed: $e');
        }
      }
    } finally {
      _draining = false;
    }
  }
}
