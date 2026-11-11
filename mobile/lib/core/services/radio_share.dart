import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../radio/station_catalog.dart';

/// Links a listener can send for the station on air, or the artist playing.
///
/// The https links open the app when it is installed. The station page sends
/// someone without the app to TestFlight today, and to the App Store once
/// NEXT_PUBLIC_IOS_APP_URL points there.
class RadioShare {
  RadioShare._();

  static const String siteOrigin = 'https://www.networxradio.com';

  static String stationLink(String stationId) =>
      '$siteOrigin/radio/${Uri.encodeComponent(stationId)}';

  static String artistLink(String artistId, {String? songId}) {
    final base = '$siteOrigin/artists/${Uri.encodeComponent(artistId)}';
    final song = songId?.trim() ?? '';
    if (song.isEmpty) return base;
    return '$base?song=${Uri.encodeComponent(song)}';
  }

  static String stationMessage(String stationId) {
    final name = stationLabel(stationId);
    return 'Listen to $name on NETWORX Radio.\n${stationLink(stationId)}\n\n'
        "If you don't have the app yet, this link takes you to download it.";
  }

  static String artistMessage({
    required String artistId,
    required String artistName,
    String? songTitle,
    String? songId,
  }) {
    final name = artistName.trim().isEmpty ? 'This artist' : artistName.trim();
    final title = songTitle?.trim() ?? '';
    final lead = title.isEmpty
        ? '$name is on NETWORX Radio.'
        : '$name is on NETWORX Radio right now with "$title".';
    return '$lead\n${artistLink(artistId, songId: songId)}';
  }

  static Future<void> shareStation(
    String stationId, {
    Rect? origin,
  }) {
    return SharePlus.instance.share(
      ShareParams(
        text: stationMessage(stationId),
        subject: stationLabel(stationId),
        sharePositionOrigin: origin,
      ),
    );
  }

  static Future<void> shareArtist({
    required String artistId,
    required String artistName,
    String? songTitle,
    String? songId,
    Rect? origin,
  }) {
    return SharePlus.instance.share(
      ShareParams(
        text: artistMessage(
          artistId: artistId,
          artistName: artistName,
          songTitle: songTitle,
          songId: songId,
        ),
        subject: artistName,
        sharePositionOrigin: origin,
      ),
    );
  }

  static Future<void> showSheet(
    BuildContext context, {
    required String stationId,
    String? artistId,
    String? artistName,
    String? songTitle,
    String? songId,
  }) {
    final artist = artistId?.trim() ?? '';
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.radio),
              title: Text('Share ${stationLabel(stationId)}'),
              subtitle: const Text('Opens this station, or the download page'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                shareStation(stationId);
              },
            ),
            ListTile(
              enabled: artist.isNotEmpty,
              leading: const Icon(Icons.person_outline),
              title: const Text('Share artist page'),
              subtitle: Text(
                artist.isEmpty
                    ? 'No artist is on this track'
                    : (artistName?.trim().isNotEmpty == true
                        ? artistName!.trim()
                        : 'Who is playing now'),
              ),
              onTap: artist.isEmpty
                  ? null
                  : () {
                      Navigator.of(sheetContext).pop();
                      shareArtist(
                        artistId: artist,
                        artistName: artistName ?? 'This artist',
                        songTitle: songTitle,
                        songId: songId,
                      );
                    },
            ),
          ],
        ),
      ),
    );
  }
}
