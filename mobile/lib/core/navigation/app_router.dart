import 'package:flutter/material.dart';
import '../../features/about/about_screen.dart';
import '../../features/analytics/analytics_screen.dart';
import '../../features/apply/apply_screen.dart';
import '../../features/artist/artist_profile_screen.dart';
import '../../features/competition/competition_screen.dart';
import '../../features/credits/credits_screen.dart';
import '../../features/discovery/discovery_screen.dart';
import '../../features/job_board/job_board_screen.dart';
import '../../features/livestream/go_live_screen.dart';
import '../../features/livestream/stream_settings_screen.dart';
import '../../features/livestream/watch_live_screen.dart';
import '../../features/messages/messages_screen.dart';
import '../../features/nearby/nearby_people_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/payment/payment_screen.dart';
import '../../features/player/player_screen.dart';
import '../../features/pro_networx/pro_directory_screen.dart';
import '../../features/pro_networx/pro_me_profile_screen.dart';
import '../../features/pro_networx/pro_profile_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/refinery/refinery_screen.dart';
import '../../features/room/room_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/studio/buy_plays_screen.dart';
import '../../features/studio/live_services_screen.dart';
import '../../features/studio/studio_screen.dart';
import '../../features/upload/upload_screen.dart';
import '../../features/yield/yield_screen.dart';
import '../../widgets/home_screen.dart';
import '../../widgets/login_screen.dart';
import '../../widgets/require_artist.dart';
import '../../widgets/require_gem_capability.dart';
import '../models/job_board_models.dart';
import '../models/song.dart';
import 'app_routes.dart';

class AppRouter {
  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    final args = settings.arguments;
    switch (settings.name) {
      case AppRoutes.login:
        return _route(const LoginScreen(), settings);
      case AppRoutes.home:
        return _route(const HomeScreen(), settings);
      case AppRoutes.player:
        return _route(const PlayerScreen(), settings);
      case AppRoutes.analytics:
        return _route(const AnalyticsScreen(), settings);
      case AppRoutes.upload:
        return _route(const RequireArtist(child: UploadScreen()), settings);
      case AppRoutes.profile:
        return _route(const ProfileScreen(), settings);
      case AppRoutes.payment:
        return _route(const RequireArtist(child: PaymentScreen()), settings);
      case AppRoutes.settings:
        return _route(const SettingsScreen(), settings);
      case AppRoutes.notifications:
        return _route(const NotificationsScreen(), settings);
      case AppRoutes.credits:
        return _route(const CreditsScreen(), settings);
      case AppRoutes.messages:
        return _route(const MessagesScreen(), settings);
      case AppRoutes.thread:
        if (args is Map<String, dynamic>) {
          return _route(
            ThreadScreen(
              myUserId: args['myUserId'].toString(),
              otherUserId: args['otherUserId'].toString(),
              otherDisplayName: args['otherDisplayName']?.toString(),
            ),
            settings,
          );
        }
        return _unknown(settings);
      case AppRoutes.streamSettings:
        return _route(const StreamSettingsScreen(), settings);
      case AppRoutes.goLive:
        return _route(const GoLiveScreen(), settings);
      case AppRoutes.watchLive:
        final artistId = args?.toString();
        if (artistId == null || artistId.isEmpty) return _unknown(settings);
        return _route(WatchLiveScreen(artistId: artistId), settings);
      case AppRoutes.proDirectory:
        return _route(const ProNetworxDirectoryScreen(), settings);
      case AppRoutes.proMeProfile:
        return _route(const ProNetworxMeProfileScreen(), settings);
      case AppRoutes.proProfile:
        final userId = args?.toString();
        if (userId == null || userId.isEmpty) return _unknown(settings);
        return _route(ProNetworxProfileScreen(userId: userId), settings);
      case AppRoutes.nearbyPeople:
        return _route(const NearbyPeopleScreen(), settings);
      case AppRoutes.refinery:
        return _route(const RefineryScreen(), settings);
      case AppRoutes.yield:
        return _route(const YieldScreen(), settings);
      case AppRoutes.about:
        return _route(const AboutScreen(), settings);
      case AppRoutes.studio:
        return _route(const StudioScreen(), settings);
      case AppRoutes.competition:
        return _route(const CompetitionScreen(), settings);
      case AppRoutes.room:
        return _route(const RoomScreen(), settings);
      case AppRoutes.discovery:
        return _route(const DiscoveryScreen(), settings);
      case AppRoutes.jobBoard:
        return _route(const JobBoardScreen(), settings);
      case AppRoutes.apply:
        return _route(const ApplyScreen(), settings);
      case AppRoutes.artistProfile:
        final artistId = args?.toString();
        if (artistId == null || artistId.isEmpty) return _unknown(settings);
        return _route(ArtistProfileScreen(artistId: artistId), settings);
      case AppRoutes.buyPlays:
        if (args is Song) {
          return _route(BuyPlaysScreen(song: args), settings);
        }
        return _unknown(settings);
      case AppRoutes.liveServices:
        return _route(
          const RequireGemCapability(child: LiveServicesScreen()),
          settings,
        );
      default:
        return null;
    }
  }

  static Route<dynamic> routeToRequestDetail({
    required ServiceRequestRow request,
    String? myUserId,
  }) {
    return MaterialPageRoute<void>(
      builder: (_) => RequestDetailScreen(request: request, myUserId: myUserId),
    );
  }

  static Route<dynamic> _unknown(RouteSettings settings) {
    return MaterialPageRoute<void>(
      settings: settings,
      builder: (_) => Scaffold(
        appBar: AppBar(title: const Text('Unknown route')),
        body: Center(
          child: Text('Route not found: ${settings.name ?? '(unnamed)'}'),
        ),
      ),
    );
  }

  static MaterialPageRoute<dynamic> _route(Widget screen, RouteSettings settings) {
    return MaterialPageRoute<dynamic>(
      settings: settings,
      builder: (_) => screen,
    );
  }
}
