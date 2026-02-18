import '../models/job_board_models.dart';
import 'api_service.dart';

class JobBoardService {
  final ApiService _api = ApiService();

  Future<RequestsPage> listRequests({
    String? serviceType,
    String? status,
    bool? mine,
    int limit = 30,
    int offset = 0,
  }) async {
    final params = <String>[
      if (serviceType != null) 'serviceType=$serviceType',
      if (status != null) 'status=$status',
      if (mine != null) 'mine=$mine',
      'limit=$limit',
      'offset=$offset',
    ].join('&');
    final res = await _api.get('job-board/requests?$params');
    if (res is Map<String, dynamic>) return RequestsPage.fromJson(res);
    return const RequestsPage(items: [], total: 0);
  }

  Future<ServiceRequestRow?> getRequest(String requestId) async {
    final res = await _api.get('job-board/requests/$requestId');
    if (res is Map<String, dynamic>) return ServiceRequestRow.fromJson(res);
    return null;
  }

  Future<void> apply(String requestId, {String? message}) async {
    await _api.post('job-board/requests/$requestId/applications', {
      'message': message,
    });
  }

  Future<List<ServiceRequestApplicationRow>> listApplications(
      String requestId) async {
    final res = await _api.get('job-board/requests/$requestId/applications');
    if (res is List) {
      return res
          .whereType<Map>()
          .map((e) => ServiceRequestApplicationRow.fromJson(
                e.map((k, v) => MapEntry(k.toString(), v)),
              ))
          .toList();
    }
    return const [];
  }
}

