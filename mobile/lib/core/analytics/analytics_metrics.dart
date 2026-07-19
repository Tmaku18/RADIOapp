/// Canonical copy for Listens vs Ears Reached across mobile UI.
/// Port of web [analytics-metrics.ts].
class AnalyticsMetricDef {
  const AnalyticsMetricDef({
    required this.label,
    required this.description,
    required this.shortSub,
  });

  final String label;
  final String description;
  final String shortSub;
}

class AnalyticsMetrics {
  static const listens = AnalyticsMetricDef(
    label: 'Listens',
    description: 'People who heard a song (once per song per person)',
    shortSub: 'once per song',
  );

  static const earsReached = AnalyticsMetricDef(
    label: 'Ears Reached',
    description: 'Unique listeners — each account or device counts once',
    shortSub: 'unique accounts',
  );

  static const spins = AnalyticsMetricDef(
    label: 'Spins',
    description: 'Total radio play events',
    shortSub: 'play events',
  );

  static const liveListeners = AnalyticsMetricDef(
    label: 'Live Listeners',
    description: 'Prospectors tuned in right now',
    shortSub: 'tuned in now',
  );
}

String formatMetricCount(int n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M+';
  if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K+';
  return n.toString();
}

int resolveListens(Map<String, dynamic> song) {
  final listens = song['listens'];
  if (listens is num) return listens.toInt();
  final totalListenCount = song['totalListenCount'];
  if (totalListenCount is num) return totalListenCount.toInt();
  final listenCount = song['listenCount'];
  if (listenCount is num) return listenCount.toInt();
  final playCount = song['playCount'];
  final profilePlayCount = song['profilePlayCount'];
  if (playCount is num || profilePlayCount is num) {
    return (playCount is num ? playCount.toInt() : 0) +
        (profilePlayCount is num ? profilePlayCount.toInt() : 0);
  }
  final earsReached = song['earsReached'];
  if (earsReached is num) return earsReached.toInt();
  return 0;
}

int resolveEarsReached(Map<String, dynamic> song) {
  final ears = song['earsReached'] ?? song['ears_reached'];
  if (ears is num) return ears.toInt();
  return resolveListens(song);
}
