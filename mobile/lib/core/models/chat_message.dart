/// Model class for chat messages in the live radio chat.
class ChatMessage {
  final String id;
  final String userId;
  final String? songId;
  final String? radioId;
  final String displayName;
  final String? avatarUrl;
  final String message;
  final DateTime createdAt;
  final bool isSystemMessage;

  ChatMessage({
    required this.id,
    required this.userId,
    this.songId,
    this.radioId,
    required this.displayName,
    this.avatarUrl,
    required this.message,
    required this.createdAt,
    this.isSystemMessage = false,
  });

  /// Create a ChatMessage from JSON response (camelCase or snake_case).
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final createdRaw =
        (json['createdAt'] ?? json['created_at'] ?? '').toString();
    return ChatMessage(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      songId: (json['songId'] ?? json['song_id'])?.toString(),
      radioId: (json['radioId'] ?? json['radio_id'])?.toString(),
      displayName:
          (json['displayName'] ?? json['display_name'] ?? 'Anonymous')
              .toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      message: (json['message'] ?? '').toString(),
      createdAt: DateTime.tryParse(createdRaw) ?? DateTime.now(),
      isSystemMessage: false,
    );
  }

  /// Convert ChatMessage to JSON for API requests
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'songId': songId,
      'radioId': radioId,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'message': message,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Factory constructor for song transition system messages
  factory ChatMessage.songTransition(String songTitle) {
    return ChatMessage(
      id: 'system-${DateTime.now().millisecondsSinceEpoch}',
      userId: 'system',
      displayName: 'Radio',
      message: '--- Now Playing: $songTitle ---',
      createdAt: DateTime.now(),
      isSystemMessage: true,
    );
  }

  /// Factory constructor for connection status messages
  factory ChatMessage.connectionStatus(String status) {
    return ChatMessage(
      id: 'system-conn-${DateTime.now().millisecondsSinceEpoch}',
      userId: 'system',
      displayName: 'System',
      message: status,
      createdAt: DateTime.now(),
      isSystemMessage: true,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ChatMessage && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
