class FollowListItem {
  final String id;
  final String? displayName;
  final String? username;
  final String? avatarUrl;
  final String? headline;
  final String? role;
  final String? relationship;

  const FollowListItem({
    required this.id,
    required this.displayName,
    this.username,
    required this.avatarUrl,
    required this.headline,
    required this.role,
    this.relationship,
  });

  factory FollowListItem.fromJson(Map<String, dynamic> json) {
    return FollowListItem(
      id: (json['id'] ?? '').toString(),
      displayName: json['displayName']?.toString(),
      username: json['username']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      headline: json['headline']?.toString(),
      role: json['role']?.toString(),
      relationship: json['relationship']?.toString(),
    );
  }
}
