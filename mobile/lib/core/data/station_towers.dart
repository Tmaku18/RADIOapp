/// National station towers — mirrors web `TOWERS` in `station-map.ts`.
class StationTower {
  const StationTower({required this.id, required this.genre});

  final String id;
  final String genre;
}

const List<StationTower> kNationalStationTowers = [
  StationTower(id: 'us-rap', genre: 'New School Rap Radio'),
  StationTower(id: 'us-old-school-rap', genre: 'Old School Rap Radio'),
  StationTower(id: 'us-rap-clean', genre: 'Clean Rap Radio'),
  StationTower(id: 'us-ready-now-rap', genre: 'Ready Now Radio'),
  StationTower(id: 'us-hip-hop', genre: 'Hip Hop'),
  StationTower(id: 'us-country', genre: 'Country'),
  StationTower(id: 'us-rock', genre: 'Rock'),
  StationTower(id: 'us-metal', genre: 'Metal Radio'),
  StationTower(id: 'us-pop', genre: 'Pop'),
  StationTower(id: 'us-kids-friendly', genre: 'Kids Friendly Radio'),
  StationTower(id: 'us-testing-grounds', genre: 'Testing Grounds Radio'),
  StationTower(id: 'us-rideshare', genre: 'Rideshare Radio'),
  StationTower(id: 'us-edm', genre: 'EDM'),
  StationTower(id: 'us-rnb', genre: 'R&B'),
  StationTower(id: 'us-podcasts', genre: 'Podcasts'),
  StationTower(id: 'us-spoken-word', genre: 'Spoken Word'),
  StationTower(id: 'us-comedian', genre: 'Comedian'),
  StationTower(id: 'us-gospel', genre: 'Gospel'),
  StationTower(id: 'us-classical', genre: 'Classical Radio'),
  StationTower(id: 'us-emo', genre: 'Emo Radio'),
  StationTower(id: 'us-ai-created', genre: 'AI Created Radio'),
  StationTower(id: 'us-beats', genre: 'Beats Radio'),
  StationTower(id: 'us-freestyle', genre: 'Freestyle Radio'),
  StationTower(id: 'us-instrumental', genre: 'Instrumental Radio'),
  StationTower(id: 'us-lofi', genre: 'Lo-Fi Radio'),
  StationTower(id: 'us-jazz', genre: 'Jazz Radio'),
  StationTower(id: 'us-audiobook', genre: 'Audiobook Radio'),
  StationTower(id: 'us-spanish', genre: 'Spanish Radio'),
  StationTower(id: 'us-afrobeats', genre: 'Afro-Beats Radio'),
  StationTower(id: 'us-dj-mixes', genre: 'DJ Mixes Radio'),
];

const List<String> kUsStateCodes = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
];
