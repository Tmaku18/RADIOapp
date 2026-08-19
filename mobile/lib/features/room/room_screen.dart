import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/chat_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import '../player/widgets/butterfly_swarm_backdrop.dart';
import '../player/widgets/chat_panel.dart';

class RoomScreen extends StatelessWidget {
  const RoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(),
      child: const DimensionScreenShell(
        title: 'The Chat Room',
        showNeonLine: true,
        backdrop: IgnorePointer(
          child: ButterflySwarmBackdrop(butterflyCount: 22),
        ),
        body: ChatPanel(
          isExpanded: true,
          fillHeightWhenExpanded: true,
          expandedHeight: 9999,
          transparentBackground: true,
        ),
      ),
    );
  }
}

