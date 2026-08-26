class AppNotification {
  final String id;
  final String type;
  final String title;
  final String? message;
  final bool read;
  final DateTime? createdAt;
  final Map<String, dynamic>? metadata;

  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.read,
    required this.createdAt,
    this.metadata,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString());
    }

    Map<String, dynamic>? parseMetadata(dynamic value) {
      if (value is Map) {
        return Map<String, dynamic>.from(value);
      }
      return null;
    }

    return AppNotification(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      message: json['message']?.toString(),
      read: json['read'] == true,
      createdAt: parseDate(json['createdAt'] ?? json['created_at']),
      metadata: parseMetadata(json['metadata']),
    );
  }

  String? get copyrightTitle {
    final value = metadata?['copyrightTitle']?.toString().trim();
    return (value == null || value.isEmpty) ? null : value;
  }

  String? get copyrightArtists {
    final value = metadata?['copyrightArtists']?.toString().trim();
    return (value == null || value.isEmpty) ? null : value;
  }
}
