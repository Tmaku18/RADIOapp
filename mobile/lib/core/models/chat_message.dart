/// Model class for chat messages in the live radio chat.
class ChatMessage {
  final String id;
  final String userId;
  final String? songId;
  final String displayName;
  final String? avatarUrl;
  final String message;
  final DateTime createdAt;
  final bool isSystemMessage;

  ChatMessage({
    required this.id,
    required this.userId,
    this.songId,
    required this.displayName,
    this.avatarUrl,
    required this.message,
    required this.createdAt,
    this.isSystemMessage = false,
  });

  /// Create a ChatMessage from JSON response
  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      userId: json['userId'] as String,
      songId: json['songId'] as String?,
      displayName: json['displayName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      message: json['message'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isSystemMessage: false,
    );
  }

  /// Convert ChatMessage to JSON for API requests
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'songId': songId,
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
