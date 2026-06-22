import 'package:flutter/material.dart';

import '../../core/navigation/app_routes.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'widgets/pro_networx_directory_content.dart';

class ProNetworxDirectoryScreen extends StatelessWidget {
  const ProNetworxDirectoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pro-Networx Directory'),
        actions: [
          const BackToNetworxRadioButton(compact: true),
          IconButton(
            tooltip: 'Build my profile',
            onPressed: () => Navigator.pushNamed(context, AppRoutes.proMeProfile),
            icon: const Icon(Icons.edit_note),
          ),
        ],
      ),
      body: const ProNetworxDirectoryContent(
        title: 'Directory',
        subtitle: 'Find Catalysts by skill, availability, and location.',
        showEditProfile: false,
        smartRanking: false,
      ),
    );
  }
}
