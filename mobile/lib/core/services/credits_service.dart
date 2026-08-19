import 'api_service.dart';

class CreditsService {
  final ApiService _api = ApiService();

  Future<Map<String, dynamic>> getBalance() async {
    final res = await _api.get('credits/balance');
    return (res is Map<String, dynamic>) ? res : <String, dynamic>{};
  }
}

