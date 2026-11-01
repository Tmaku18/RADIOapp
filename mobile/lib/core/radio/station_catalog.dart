class StationOption {
  const StationOption({required this.id, required this.genre});

  final String id;
  final String genre;
}

const List<StationOption> kStationCatalog = <StationOption>[
  StationOption(id: 'us-ready-now-rap', genre: 'Ready Now Radio'),
  StationOption(id: 'us-rap', genre: 'New School Rap Radio'),
  StationOption(id: 'us-old-school-rap', genre: 'Old School Rap Radio'),
  StationOption(id: 'us-rap-clean', genre: 'Clean Rap Radio'),
  StationOption(id: 'us-hip-hop', genre: 'Hip Hop'),
  StationOption(id: 'us-country', genre: 'Country'),
  StationOption(id: 'us-rock', genre: 'Rock'),
  StationOption(id: 'us-metal', genre: 'Metal Radio'),
  StationOption(id: 'us-pop', genre: 'Pop'),
  StationOption(id: 'us-kids-friendly', genre: 'Kids Friendly Radio'),
  StationOption(id: 'us-testing-grounds', genre: 'Testing Grounds Radio'),
  StationOption(id: 'us-rideshare', genre: 'Rideshare Radio'),
  StationOption(id: 'us-edm', genre: 'EDM'),
  StationOption(id: 'us-rnb', genre: 'R&B'),
  StationOption(id: 'us-podcasts', genre: 'Podcasts'),
  StationOption(id: 'us-spoken-word', genre: 'Spoken Word'),
  StationOption(id: 'us-comedian', genre: 'Comedian'),
  StationOption(id: 'us-gospel', genre: 'Gospel'),
  StationOption(id: 'us-classical', genre: 'Classical Radio'),
  StationOption(id: 'us-emo', genre: 'Emo Radio'),
  StationOption(id: 'us-ai-created', genre: 'AI Created Radio'),
  StationOption(id: 'us-beats', genre: 'Beats Radio'),
  StationOption(id: 'us-freestyle', genre: 'Freestyle Radio'),
  StationOption(id: 'us-instrumental', genre: 'Instrumental Radio'),
  StationOption(id: 'us-lofi', genre: 'Lo-Fi Radio'),
  StationOption(id: 'us-jazz', genre: 'Jazz Radio'),
  StationOption(id: 'us-audiobook', genre: 'Audiobook Radio'),
  StationOption(id: 'us-spanish', genre: 'Spanish Radio'),
  StationOption(id: 'us-afrobeats', genre: 'Afro-Beats Radio'),
  StationOption(id: 'us-dj-mixes', genre: 'DJ Mixes Radio'),
];

StationOption? stationById(String id) {
  for (final station in kStationCatalog) {
    if (station.id == id) return station;
  }
  return null;
}

String stationLabel(String? id) {
  if (id == null || id.isEmpty) return 'NetworX Radio';
  return stationById(id)?.genre ?? 'NetworX Radio';
}
