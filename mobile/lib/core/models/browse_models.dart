class BrowseProvider {
  final String userId;
  final String? displayName;
  final String? avatarUrl;

  BrowseProvider({
    required this.userId,
    required this.displayName,
    required this.avatarUrl,
  });

  factory BrowseProvider.fromJson(Map<String, dynamic> json) {
    return BrowseProvider(
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      displayName: (json['displayName'] ?? json['display_name'])?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
    );
  }
}

class BrowseFeedItem {
  final String id;
  final String type; // 'image' | 'audio'
  final String fileUrl;
  final String? title;
  final String? description;
  final BrowseProvider provider;
  final int likeCount;
  final int bookmarkCount;
  final bool liked;
  final bool bookmarked;

  BrowseFeedItem({
    required this.id,
    required this.type,
    required this.fileUrl,
    required this.title,
    required this.description,
    required this.provider,
    required this.likeCount,
    required this.bookmarkCount,
    required this.liked,
    required this.bookmarked,
  });

  factory BrowseFeedItem.fromJson(Map<String, dynamic> json) {
    return BrowseFeedItem(
      id: (json['id'] ?? '').toString(),
      type: (json['type'] ?? 'image').toString(),
      fileUrl: (json['fileUrl'] ?? json['file_url'] ?? '').toString(),
      title: json['title']?.toString(),
      description: json['description']?.toString(),
      provider: BrowseProvider.fromJson(
        (json['provider'] as Map?)?.map((k, v) => MapEntry(k.toString(), v)) ??
            const <String, dynamic>{},
      ),
      likeCount: (json['likeCount'] ?? json['like_count'] ?? 0) is int
          ? (json['likeCount'] ?? json['like_count'] ?? 0) as int
          : int.tryParse((json['likeCount'] ?? json['like_count'] ?? '0').toString()) ??
              0,
      bookmarkCount:
          (json['bookmarkCount'] ?? json['bookmark_count'] ?? 0) is int
              ? (json['bookmarkCount'] ?? json['bookmark_count'] ?? 0) as int
              : int.tryParse(
                    (json['bookmarkCount'] ?? json['bookmark_count'] ?? '0')
                        .toString(),
                  ) ??
                  0,
      liked: json['liked'] == true,
      bookmarked: json['bookmarked'] == true,
    );
  }

  BrowseFeedItem copyWith({
    int? likeCount,
    int? bookmarkCount,
    bool? liked,
    bool? bookmarked,
  }) {
    return BrowseFeedItem(
      id: id,
      type: type,
      fileUrl: fileUrl,
      title: title,
      description: description,
      provider: provider,
      likeCount: likeCount ?? this.likeCount,
      bookmarkCount: bookmarkCount ?? this.bookmarkCount,
      liked: liked ?? this.liked,
      bookmarked: bookmarked ?? this.bookmarked,
    );
  }
}

class BrowseFeedPage {
  final List<BrowseFeedItem> items;
  final String? nextCursor;
  const BrowseFeedPage({required this.items, required this.nextCursor});

  factory BrowseFeedPage.fromJson(Map<String, dynamic> json) {
    final raw = (json['items'] as List?) ?? const [];
    return BrowseFeedPage(
      items: raw
          .whereType<Map>()
          .map((e) => BrowseFeedItem.fromJson(
              e.map((k, v) => MapEntry(k.toString(), v))))
          .toList(),
      nextCursor: json['nextCursor']?.toString() ?? json['next_cursor']?.toString(),
    );
  }
}

