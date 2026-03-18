class FollowListItem {
  final String id;
  final String? displayName;
  final String? avatarUrl;
  final String? headline;
  final String? role;

  const FollowListItem({
    required this.id,
    required this.displayName,
    required this.avatarUrl,
    required this.headline,
    required this.role,
  });

  factory FollowListItem.fromJson(Map<String, dynamic> json) {
    return FollowListItem(
      id: (json['id'] ?? '').toString(),
      displayName: json['displayName']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      headline: json['headline']?.toString(),
      role: json['role']?.toString(),
    );
  }
}
