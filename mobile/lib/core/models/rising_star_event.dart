class RisingStarEvent {
  final String songId;
  final String? playId;
  final String songTitle;
  final String artistName;
  final double? conversion;

  const RisingStarEvent({
    required this.songId,
    required this.songTitle,
    required this.artistName,
    this.playId,
    this.conversion,
  });

  factory RisingStarEvent.fromPayload(Map<String, dynamic> payload) {
    final conversionRaw = payload['conversion'];
    double? conversion;
    if (conversionRaw is num) conversion = conversionRaw.toDouble();
    if (conversionRaw is String) conversion = double.tryParse(conversionRaw);

    return RisingStarEvent(
      songId: (payload['songId'] ?? payload['song_id'] ?? '').toString(),
      playId: (payload['playId'] ?? payload['play_id'])?.toString(),
      songTitle: (payload['songTitle'] ?? payload['song_title'] ?? 'A song').toString(),
      artistName: (payload['artistName'] ?? payload['artist_name'] ?? 'An artist').toString(),
      conversion: conversion,
    );
  }
}

