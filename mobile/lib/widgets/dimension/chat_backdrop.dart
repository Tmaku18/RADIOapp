import 'package:flutter/material.dart';

import '../../features/player/widgets/butterfly_swarm_backdrop.dart';

/// Shared wallpaper for DMs and radio chat — same field as The Chat Room.
class ChatBackdrop extends StatelessWidget {
  const ChatBackdrop({super.key, this.butterflyCount = 22});

  final int butterflyCount;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: ButterflySwarmBackdrop(butterflyCount: butterflyCount),
    );
  }
}
