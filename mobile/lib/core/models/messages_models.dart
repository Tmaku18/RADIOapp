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

class MessageReaction {
  final String emoji;
  final String userId;

  const MessageReaction({required this.emoji, required this.userId});

  factory MessageReaction.fromJson(Map<String, dynamic> json) {
    return MessageReaction(
      emoji: (json['emoji'] ?? '').toString(),
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
    );
  }
}

class SharedPostSnapshot {
  final String id;
  final String authorUserId;
  final String? authorDisplayName;
  final String? authorUsername;
  final String? authorAvatarUrl;
  final String imageUrl;
  final String mediaType;
  final String? caption;

  const SharedPostSnapshot({
    required this.id,
    required this.authorUserId,
    required this.authorDisplayName,
    required this.authorUsername,
    required this.authorAvatarUrl,
    required this.imageUrl,
    required this.mediaType,
    required this.caption,
  });

  factory SharedPostSnapshot.fromJson(Map<String, dynamic> json) {
    return SharedPostSnapshot(
      id: (json['id'] ?? '').toString(),
      authorUserId: (json['authorUserId'] ?? '').toString(),
      authorDisplayName: (json['authorDisplayName'])?.toString(),
      authorUsername: (json['authorUsername'])?.toString(),
      authorAvatarUrl: (json['authorAvatarUrl'])?.toString(),
      imageUrl: (json['imageUrl'] ?? '').toString(),
      mediaType: (json['mediaType'] ?? 'image').toString(),
      caption: (json['caption'])?.toString(),
    );
  }
}

class MessageRow {
  final String id;
  final String senderId;
  final String recipientId;
  final String body;
  final DateTime createdAt;
  final String messageType;
  final String? mediaUrl;
  final DateTime? editedAt;
  final DateTime? unsentAt;
  final List<MessageReaction> reactions;
  final String? sharedPostId;
  final SharedPostSnapshot? sharedPost;

  MessageRow({
    required this.id,
    required this.senderId,
    required this.recipientId,
    required this.body,
    required this.createdAt,
    this.messageType = 'text',
    this.mediaUrl,
    this.editedAt,
    this.unsentAt,
    this.reactions = const [],
    this.sharedPostId,
    this.sharedPost,
  });

  bool get isEdited => editedAt != null;
  bool get isUnsent => unsentAt != null;

  factory MessageRow.fromJson(Map<String, dynamic> json) {
    DateTime? parseOrNull(dynamic v) {
      if (v == null) return null;
      return DateTime.tryParse(v.toString());
    }

    final rawReactions = json['reactions'];
    final rawSharedPost = json['sharedPost'];
    return MessageRow(
      id: (json['id'] ?? '').toString(),
      senderId: (json['senderId'] ?? json['sender_id'] ?? '').toString(),
      recipientId: (json['recipientId'] ?? json['recipient_id'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['created_at'] ?? '').toString()) ??
          DateTime.now(),
      messageType:
          (json['messageType'] ?? json['message_type'] ?? 'text').toString(),
      mediaUrl: (json['mediaUrl'] ?? json['media_url'])?.toString(),
      editedAt: parseOrNull(json['editedAt'] ?? json['edited_at']),
      unsentAt: parseOrNull(json['unsentAt'] ?? json['unsent_at']),
      reactions: rawReactions is List
          ? rawReactions
              .whereType<Map>()
              .map((e) =>
                  MessageReaction.fromJson(e.map((k, v) => MapEntry(k.toString(), v))))
              .toList()
          : const [],
      sharedPostId:
          (json['sharedPostId'] ?? json['shared_post_id'])?.toString(),
      sharedPost: rawSharedPost is Map
          ? SharedPostSnapshot.fromJson(
              rawSharedPost.map((k, v) => MapEntry(k.toString(), v)),
            )
          : null,
    );
  }
}

