import 'package:flutter/material.dart';
import '../../features/about/about_screen.dart';
import '../../features/admin/admin_dashboard_screen.dart';
import '../../features/analytics/analytics_screen.dart';
import '../../features/apply/apply_screen.dart';
import '../../features/artist/artist_profile_screen.dart';
import '../../features/competition/competition_screen.dart';
import '../../features/credits/credits_screen.dart';
import '../../features/discovery/discovery_screen.dart';
import '../../features/job_board/job_board_screen.dart';
import '../../features/livestream/go_live_screen.dart';
import '../../features/livestream/live_sessions_screen.dart';
import '../../features/livestream/stream_settings_screen.dart';
import '../../features/livestream/watch_live_screen.dart';
import '../../features/messages/messages_screen.dart';
import '../../features/nearby/nearby_people_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/payment/payment_screen.dart';
import '../../features/player/player_screen.dart';
import '../../features/pro_networx/pro_directory_screen.dart';
import '../../features/pro_networx/pro_explore_detail_screen.dart';
import '../../features/pro_networx/pro_me_profile_screen.dart';
import '../../features/pro_networx/pro_my_services_screen.dart';
import '../../features/pro_networx/pro_networx_landing_screen.dart';
import '../../features/pro_networx/pro_networx_shell_screen.dart';
import '../../features/pro_networx/pro_profile_screen.dart';
import '../../features/pro_networx/pro_service_detail_screen.dart';
import '../../features/pro_networx/saved_liked_posts_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/refinery/refinery_screen.dart';
import '../../features/refinery/refinery_analytics_screen.dart';
import '../../features/room/room_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/studio/allocate_plays_screen.dart';
import '../../features/studio/buy_plays_screen.dart';
import '../../features/studio/live_services_screen.dart';
import '../../features/studio/studio_screen.dart';
import '../../features/discovery/discover_create_video_screen.dart';
import '../../features/upload/upload_screen.dart';
import '../../features/yield/yield_screen.dart';
import '../../widgets/home_screen.dart';
import '../../widgets/login_screen.dart';
import '../../widgets/require_artist.dart';
import '../../widgets/require_admin.dart';
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
        return _route(
          const RequireGemCapability(child: UploadScreen()),
          settings,
        );
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
        // Accept a host-type string ('dj'/'musician'); tolerate the legacy
        // `true` arg that meant DJ mode.
        final hostType = args is String
            ? args
            : (args == true ? 'dj' : null);
        return _route(GoLiveScreen(hostType: hostType), settings);
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
      case AppRoutes.proNetworxLanding:
        return _route(const ProNetworxLandingScreen(), settings);
      case AppRoutes.proNetworxShell:
        final initialTab = args is int ? args : 0;
        return _route(
          ProNetworxShellScreen(initialTab: initialTab),
          settings,
        );
      case AppRoutes.proNetworxExploreDetail:
        final postId = args?.toString();
        if (postId == null || postId.isEmpty) return _unknown(settings);
        return _route(
          ProExploreDetailScreen(anchorPostId: postId),
          settings,
        );
      case AppRoutes.proNetworxServiceDetail:
        final serviceId = args?.toString();
        if (serviceId == null || serviceId.isEmpty) return _unknown(settings);
        return _route(
          ProServiceDetailScreen(serviceId: serviceId),
          settings,
        );
      case AppRoutes.proNetworxMyServices:
        return _route(const ProMyServicesScreen(), settings);
      case AppRoutes.savedPosts:
        return _route(const SavedLikedPostsScreen(mode: 'saved'), settings);
      case AppRoutes.likedPosts:
        return _route(const SavedLikedPostsScreen(mode: 'liked'), settings);
      case AppRoutes.nearbyPeople:
        return _route(const NearbyPeopleScreen(), settings);
      case AppRoutes.refinery:
        return _route(const RefineryScreen(), settings);
      case AppRoutes.refineryAnalytics:
        final songId = args?.toString();
        if (songId == null || songId.isEmpty) return _unknown(settings);
        return _route(RefineryAnalyticsScreen(songId: songId), settings);
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
        final tabIndex = args is int ? args : 0;
        return _route(
          DiscoveryScreen(initialTabIndex: tabIndex),
          settings,
        );
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
      case AppRoutes.liveSessions:
        return _route(const LiveSessionsScreen(), settings);
      case AppRoutes.liveDj:
        return _route(const LiveSessionsScreen(djMode: true), settings);
      case AppRoutes.livePerformances:
        return _route(
          const LiveSessionsScreen(performanceMode: true),
          settings,
        );
      case AppRoutes.liveServices:
        return _route(
          const RequireGemCapability(child: LiveServicesScreen()),
          settings,
        );
      case AppRoutes.adminDashboard:
        return _route(
          const RequireAdmin(child: AdminDashboardScreen()),
          settings,
        );
      case AppRoutes.allocatePlays:
        if (args is Song) {
          return _route(AllocatePlaysScreen(song: args), settings);
        }
        return _unknown(settings);
      case AppRoutes.discoverCreateVideo:
        final createArgs = args is Map ? args : null;
        return _route(
          DiscoverCreateVideoScreen(
            initialClipUrl: createArgs?['clipUrl']?.toString(),
            initialSongTitle: createArgs?['title']?.toString(),
            initialArtistName: createArgs?['artistName']?.toString(),
            initialSongId: createArgs?['songId']?.toString(),
          ),
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
