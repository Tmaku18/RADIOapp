class AdminRadio {
  final String id;
  final String state;
  final String label;

  const AdminRadio({
    required this.id,
    required this.state,
    required this.label,
  });

  factory AdminRadio.fromJson(Map<String, dynamic> json) {
    return AdminRadio(
      id: (json['id'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      label: (json['label'] ?? '').toString(),
    );
  }
}

class AdminQueueItem {
  final int position;
  final String stackId;
  final String normalizedSongId;
  final String source;
  final String title;
  final String artistName;

  const AdminQueueItem({
    required this.position,
    required this.stackId,
    required this.normalizedSongId,
    required this.source,
    required this.title,
    required this.artistName,
  });

  factory AdminQueueItem.fromJson(Map<String, dynamic> json) {
    return AdminQueueItem(
      position: json['position'] is int
          ? json['position'] as int
          : int.tryParse('${json['position']}') ?? 0,
      stackId: (json['stackId'] ?? '').toString(),
      normalizedSongId: (json['normalizedSongId'] ?? '').toString(),
      source: (json['source'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artistName: (json['artistName'] ?? '').toString(),
    );
  }
}
