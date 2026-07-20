import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/chat_service.dart';
import '../../widgets/dimension/dimension_widgets.dart';
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
        body: ChatPanel(
          isExpanded: true,
          fillHeightWhenExpanded: true,
          expandedHeight: 9999,
        ),
      ),
    );
  }
}

