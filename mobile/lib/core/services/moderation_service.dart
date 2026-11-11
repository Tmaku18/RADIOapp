import 'api_service.dart';

class ModerationService {
  final ApiService _api = ApiService();

  Future<void> report({
    required String targetType,
    required String targetId,
    required String reason,
  }) async {
    await _api.post('moderation/reports', {
      'targetType': targetType,
      'targetId': targetId,
      'reason': reason,
    });
  }
}
