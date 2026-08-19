import 'package:flutter/material.dart';

/// Arguments for [AppRoutes.artistProfile].
///
/// Pass a bare artist id string for the existing callers, or this object when
/// opening from Liked / Favorites / Library so the discography can scroll to
/// [songId].
class ArtistProfileArgs {
  final String artistId;
  final String? songId;

  const ArtistProfileArgs({required this.artistId, this.songId});

  static ArtistProfileArgs? tryParse(Object? args) {
    if (args is ArtistProfileArgs) {
      if (args.artistId.isEmpty) return null;
      return args;
    }
    if (args is Map) {
      final artistId = (args['artistId'] ?? args['artist_id'] ?? '')
          .toString()
          .trim();
      if (artistId.isEmpty) return null;
      final songRaw = (args['songId'] ?? args['song_id'])?.toString().trim();
      return ArtistProfileArgs(
        artistId: artistId,
        songId: (songRaw == null || songRaw.isEmpty) ? null : songRaw,
      );
    }
    final artistId = args?.toString().trim() ?? '';
    if (artistId.isEmpty) return null;
    return ArtistProfileArgs(artistId: artistId);
  }
}

class AppRoutes {
  static const root = '/';
  static const welcome = '/welcome';
  static const login = '/login';
  static const home = '/home';
  static const player = '/player';
  static const analytics = '/analytics';
  static const upload = '/upload';
  static const profile = '/profile';
  static const payment = '/payment';
  static const settings = '/settings';
  static const helpLegal = '/help-legal';
  static const notifications = '/notifications';
  static const credits = '/credits';
  static const messages = '/messages';
  static const thread = '/messages/thread';
  static const streamSettings = '/stream-settings';
  static const goLive = '/go-live';
  static const watchLive = '/watch-live';
  static const proDirectory = '/pro-directory';
  static const proMeProfile = '/pro-me-profile';
  static const proProfile = '/pro-profile';
  // New Pro Networks app shell.
  static const proNetworxLanding = '/pro-networx';
  static const proNetworxShell = '/pro-networx/shell';
  static const proNetworxExploreDetail = '/pro-networx/explore-detail';
  static const proNetworxServiceDetail = '/pro-networx/service-detail';
  static const proNetworxMyServices = '/pro-networx/my-services';
  /// Pro-Radio on-demand hub (subscription, playlists, queue controls).
  static const proRadio = '/pro-radio';
  static const savedPosts = '/saved-posts';
  static const likedPosts = '/liked-posts';
  static const nearbyPeople = '/nearby-people';
  /// Public studio profile. Distinct from [studio] (My Songs).
  static const studioProfile = '/studios/view';
  /// Owner editor for recording-studio pages.
  static const myStudio = '/studios/me';
  static const refinery = '/refinery';
  static const refineryReview = '/refinery-review';
  static const refineryAnalytics = '/refinery-analytics';
  static const yield = '/yield';
  static const about = '/about';
  static const studio = '/studio';
  static const competition = '/competition';
  static const room = '/room';
  static const discovery = '/discovery';
  static const jobBoard = '/job-board';
  static const apply = '/apply';
  static const artistProfile = '/artist-profile';
  static const buyPlays = '/buy-plays';
  static const liveServices = '/live-services';
  static const liveSessions = '/live';
  static const liveDj = '/live-dj';
  static const livePerformances = '/live-performances';
  static const adminDashboard = '/admin';
  static const adminDjBooth = '/admin/dj-booth';
  static const allocatePlays = '/allocate-plays';
  static const discoverCreateVideo = '/discover-create-video';

  /// Open an artist profile, optionally scrolled to [songId] in discography.
  static Future<T?> openArtistProfile<T extends Object?>(
    BuildContext context, {
    required String artistId,
    String? songId,
  }) {
    final id = artistId.trim();
    if (id.isEmpty) return Future<T?>.value(null);
    final song = songId?.trim();
    return Navigator.of(context).pushNamed<T>(
      artistProfile,
      arguments: (song == null || song.isEmpty)
          ? id
          : ArtistProfileArgs(artistId: id, songId: song),
    );
  }
}
