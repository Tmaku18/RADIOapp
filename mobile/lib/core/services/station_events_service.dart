import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/rising_star_event.dart';

/// Real-time DJ booth event pushed over the `dj-booth:{stationId}` broadcast
/// channel by the backend (mirrors `DjBoothEvent` in dj-booth-realtime.service).
class DjBoothRealtimeEvent {
  final String type;
  final double? duckVolume;
  final String? hlsUrl;

  const DjBoothRealtimeEvent({required this.type, this.duckVolume, this.hlsUrl});

  factory DjBoothRealtimeEvent.fromMap(Map<String, dynamic> map) {
    final duck = map['duckVolume'] ?? map['duck_volume'];
    return DjBoothRealtimeEvent(
      type: (map['type'] ?? '').toString(),
      duckVolume: duck is num ? duck.toDouble() : null,
      hlsUrl: (map['hlsUrl'] ?? map['hls_url'])?.toString(),
    );
  }
}

class StationEventsService {
  static final StationEventsService _instance = StationEventsService._internal();
  factory StationEventsService() => _instance;
  StationEventsService._internal();

  final _risingStarController = StreamController<RisingStarEvent>.broadcast();
  Stream<RisingStarEvent> get risingStarStream => _risingStarController.stream;

  final _djBoothController =
      StreamController<DjBoothRealtimeEvent>.broadcast();
  Stream<DjBoothRealtimeEvent> get djBoothStream => _djBoothController.stream;

  RealtimeChannel? _channel;
  RealtimeChannel? _djBoothChannel;
  bool _started = false;

  void _emitBoothEvent(dynamic raw) {
    try {
      Map<String, dynamic>? data;
      if (raw is Map<String, dynamic>) {
        // The event may arrive directly or nested under a 'payload' key.
        final nested = raw['payload'];
        if (nested is Map) {
          data = nested.map((k, v) => MapEntry(k.toString(), v));
        } else {
          data = raw;
        }
      } else if (raw is Map) {
        data = raw.map((k, v) => MapEntry(k.toString(), v));
      }
      if (data == null || data['type'] == null) return;
      _djBoothController.add(DjBoothRealtimeEvent.fromMap(data));
    } catch (e) {
      debugPrint('StationEventsService: booth parse error $e');
    }
  }

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

    // DJ booth live events (mic on/off, duck volume) so listeners hear the
    // admin go live immediately instead of waiting for the 30s radio poll.
    _djBoothChannel = client
        .channel('dj-booth:$stationId')
        .onBroadcast(
          event: 'dj_booth_event',
          callback: (payload) => _emitBoothEvent(payload),
        )
        .subscribe((status, error) {
      if (error != null) {
        debugPrint('StationEventsService: dj-booth subscribe error: $error');
      }
    });

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
    final boothCh = _djBoothChannel;
    _channel = null;
    _djBoothChannel = null;
    for (final c in [ch, boothCh]) {
      if (c != null) {
        try {
          await Supabase.instance.client.removeChannel(c);
        } catch (_) {}
      }
    }
  }

  Future<void> dispose() async {
    await stop();
    await _risingStarController.close();
    await _djBoothController.close();
  }
}

