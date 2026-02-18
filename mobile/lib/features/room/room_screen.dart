import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/services/chat_service.dart';
import '../player/widgets/chat_panel.dart';

class RoomScreen extends StatelessWidget {
  const RoomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(),
      child: Scaffold(
        appBar: AppBar(title: const Text('The Room')),
        body: const ChatPanel(
          isExpanded: true,
          fillHeightWhenExpanded: true,
          expandedHeight: 9999,
        ),
      ),
    );
  }
}

