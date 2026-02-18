import '../models/service_provider_profile.dart';
import 'api_service.dart';

class ServiceProvidersService {
  final ApiService _api = ApiService();

  Future<ServiceProviderProfile> getByUserId(String userId) async {
    final res = await _api.get('service-providers/$userId');
    if (res is Map<String, dynamic>) return ServiceProviderProfile.fromJson(res);
    throw Exception('Failed to load provider profile');
  }
}

