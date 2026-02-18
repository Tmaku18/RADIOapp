import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/rising_star_event.dart';

class StationEventsService {
  static final StationEventsService _instance = StationEventsService._internal();
  factory StationEventsService() => _instance;
  StationEventsService._internal();

  final _risingStarController = StreamController<RisingStarEvent>.broadcast();
  Stream<RisingStarEvent> get risingStarStream => _risingStarController.stream;

  RealtimeChannel? _channel;
  bool _started = false;

  Future<void> start({String stationId = 'global'}) async {
    if (_started) return;
    _started = true;

    SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (e) {
      debugPrint('StationEventsService: Supabase not initialized: $e');
      return;
    }

    _channel = client
        .channel('station-events')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'station_events',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'type',
            value: 'rising_star',
          ),
          callback: (payload) {
            try {
              final row = payload.newRecord;
              if (row.isEmpty) return;
              if ((row['station_id']?.toString() ?? 'global') != stationId) return;
              final rawPayload = row['payload'];
              if (rawPayload is Map<String, dynamic>) {
                _risingStarController.add(RisingStarEvent.fromPayload(rawPayload));
              } else if (rawPayload is Map) {
                _risingStarController.add(
                  RisingStarEvent.fromPayload(
                    rawPayload.map((k, v) => MapEntry(k.toString(), v)),
                  ),
                );
              }
            } catch (e) {
              debugPrint('StationEventsService: parse error $e');
            }
          },
        )
        .subscribe((status, error) {
      if (error != null) {
        debugPrint('StationEventsService: subscribe error: $error');
      } else {
        debugPrint('StationEventsService: status: $status');
      }
    });
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

  Future<void> dispose() async {
    await stop();
    await _risingStarController.close();
  }
}

