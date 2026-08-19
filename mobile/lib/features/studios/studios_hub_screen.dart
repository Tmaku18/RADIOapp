import 'package:flutter/material.dart';

import '../../widgets/dimension/dimension_widgets.dart';
import '../pro_networx/pro_studios_screen.dart';

/// Radio-side Studios tab — same Directory / Nearby hub as Pro-Networx.
class StudiosHubScreen extends StatelessWidget {
  const StudiosHubScreen({super.key, this.initialNearby = false});

  final bool initialNearby;

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'Studios',
      showNeonLine: true,
      body: ProStudiosScreen(initialNearby: initialNearby),
    );
  }
}
