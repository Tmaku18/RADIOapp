import 'dart:async';
import 'package:flutter/foundation.dart';
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
    if (_started) return;
    _started = true;

    SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (e) {
      debugPrint('BrowseLikeEventsService: Supabase not initialized: $e');
      return;
    }

    _channel = client
        .channel('global-like-events')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'likes',
          callback: (payload) {
            final row = payload.newRecord;
            if (row.isEmpty) return;
            _controller.add(
              BrowseLikeEvent(
                contentId: row['content_id']?.toString(),
                songId: row['song_id']?.toString(),
              ),
            );
          },
        )
        .subscribe();
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
