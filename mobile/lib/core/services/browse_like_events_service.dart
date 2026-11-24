import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

class BrowseLikeEvent {
  final String? contentId;
  final String? songId;

  const BrowseLikeEvent({
    required this.contentId,
    required this.songId,
  });
}

class BrowseLikeEventsService {
  static final BrowseLikeEventsService _instance = BrowseLikeEventsService._internal();
  factory BrowseLikeEventsService() => _instance;
  BrowseLikeEventsService._internal();

  final StreamController<BrowseLikeEvent> _controller =
      StreamController<BrowseLikeEvent>.broadcast();
  Stream<BrowseLikeEvent> get stream => _controller.stream;

  RealtimeChannel? _channel;
  bool _started = false;

  Future<void> start() async {
    // Nothing listens to this global likes feed. Skip the realtime channel.
  }

  Future<void> stop() async {
    if (!_started) return;
    _started = false;
    final ch = _channel;
    _channel = null;
    if (ch != null) {
      try {
        await Supabase.instance.client.removeChannel(ch);
      } catch (_) {}
    }
  }
}
