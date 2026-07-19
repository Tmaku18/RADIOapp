import '../models/venue_ad.dart';
import 'api_service.dart';

class VenueAdsService {
  final ApiService _api = ApiService();

  Future<VenueAd?> getCurrent({String stationId = 'global'}) async {
    final q = stationId.isNotEmpty ? '?stationId=${Uri.encodeComponent(stationId)}' : '';
    final res = await _api.get('venue-ads/current$q');
    if (res == null) return null;
    if (res is Map<String, dynamic>) return VenueAd.fromJson(res);
    return null;
  }
}

