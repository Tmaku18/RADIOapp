class ConversationSummary {
  final String otherUserId;
  final String? otherDisplayName;
  final String? otherAvatarUrl;
  final DateTime lastMessageAt;
  final String? lastMessagePreview;
  final bool lastMessageFromMe;

  ConversationSummary({
    required this.otherUserId,
    required this.otherDisplayName,
    required this.otherAvatarUrl,
    required this.lastMessageAt,
    required this.lastMessagePreview,
    required this.lastMessageFromMe,
  });

  factory ConversationSummary.fromJson(Map<String, dynamic> json) {
    return ConversationSummary(
      otherUserId: (json['otherUserId'] ?? json['other_user_id'] ?? '').toString(),
      otherDisplayName: (json['otherDisplayName'] ?? json['other_display_name'])?.toString(),
      otherAvatarUrl: (json['otherAvatarUrl'] ?? json['other_avatar_url'])?.toString(),
      lastMessageAt: DateTime.tryParse((json['lastMessageAt'] ?? json['last_message_at'] ?? '').toString()) ??
          DateTime.now(),
      lastMessagePreview: (json['lastMessagePreview'] ?? json['last_message_preview'])?.toString(),
      lastMessageFromMe: json['lastMessageFromMe'] == true || json['last_message_from_me'] == true,
    );
  }
}

class MessageRow {
  final String id;
  final String senderId;
  final String recipientId;
  final String body;
  final DateTime createdAt;

  MessageRow({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.body,
    required this.createdAt,
  });

  factory MessageRow.fromJson(Map<String, dynamic> json) {
    return MessageRow(
      id: (json['id'] ?? '').toString(),
      senderId: (json['senderId'] ?? json['sender_id'] ?? '').toString(),
      recipientId: (json['recipientId'] ?? json['recipient_id'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
    );
  }
}

