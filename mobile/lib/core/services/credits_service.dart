import 'api_service.dart';

class CreditsService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getBalance() async {
    final res = await _api.get('credits/balance');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }

  Future<void> allocateToSong(String songId, int amount) async {
    await _api.post('credits/songs/$songId/allocate', {'amount': amount});
  }

  Future<void> withdrawFromSong(String songId, int amount) async {
    await _api.post('credits/songs/$songId/withdraw', {'amount': amount});
  }
}

