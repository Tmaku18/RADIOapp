import 'package:flutter/material.dart';

import 'widgets/pro_networx_directory_content.dart';

/// Pro-Networx Home tab — web parity: curated catalyst directory, not a
/// following-only feed (`/pro-networx/home` → [ProNetworxDirectoryContent]).
class ProHomeFeedScreen extends StatelessWidget {
  const ProHomeFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProNetworxDirectoryContent(
      title: 'Discover Catalysts',
      subtitle: 'Browse the directory by skill, availability, and location.',
      showEditProfile: true,
      smartRanking: true,
    );
  }
}
