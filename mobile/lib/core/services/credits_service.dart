import 'api_service.dart';

class CreditsBalance {
  final int balance;
  final int placementBudget;
  final int totalPurchased;
  final int totalUsed;
  final int welcomePlacementsRemaining;
  final int welcomePlacementsGranted;
  final bool welcomePlacementsLocked;
  final bool welcomePlacementsAvailable;

  const CreditsBalance({
    required this.balance,
    required this.placementBudget,
    required this.totalPurchased,
    required this.totalUsed,
    required this.welcomePlacementsRemaining,
    required this.welcomePlacementsGranted,
    required this.welcomePlacementsLocked,
    required this.welcomePlacementsAvailable,
  });

  factory CreditsBalance.fromJson(Map<String, dynamic> json) {
    int asInt(dynamic v) {
      if (v is int) return v;
      if (v is num) return v.toInt();
      return int.tryParse(v?.toString() ?? '') ?? 0;
    }

    return CreditsBalance(
      balance: asInt(json['balance'] ?? json['placementBudget']),
      placementBudget: asInt(json['placementBudget'] ?? json['balance']),
      totalPurchased: asInt(json['totalPurchased'] ?? json['total_purchased']),
      totalUsed: asInt(json['totalUsed'] ?? json['total_used']),
      welcomePlacementsRemaining: asInt(
        json['welcomePlacementsRemaining'] ??
            json['welcome_placements_remaining'],
      ),
      welcomePlacementsGranted: asInt(
        json['welcomePlacementsGranted'] ?? json['welcome_placements_granted'],
      ),
      welcomePlacementsLocked: json['welcomePlacementsLocked'] == true,
      welcomePlacementsAvailable: json['welcomePlacementsAvailable'] == true,
    );
  }
}

class CreditsService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getBalance() async {
    final res = await _api.get('credits/balance');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<CreditsBalance> getCreditsBalance() async {
    final raw = await getBalance();
    return CreditsBalance.fromJson(raw);
  }

  Future<Map<String, dynamic>> applyWelcomePlacements({
    required String songId,
    required int placements,
  }) async {
    final res = await _api.post(
      'credits/songs/$songId/apply-welcome-placements',
      {'placements': placements},
    );
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }
}
