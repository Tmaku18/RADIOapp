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

  /// WHEP (WebRTC) playback URL — required to hear WHIP-published DJ mics.
  final String? whepUrl;

  const DjBoothRealtimeEvent({
    required this.type,
    this.duckVolume,
    this.hlsUrl,
    this.whepUrl,
  });

  /// Best URL to play: prefer WHEP, fall back to legacy HLS.
  String? get streamUrl {
    final whep = whepUrl?.trim();
    if (whep != null && whep.isNotEmpty) return whep;
    final hls = hlsUrl?.trim();
    if (hls != null && hls.isNotEmpty) return hls;
    return null;
  }

  factory DjBoothRealtimeEvent.fromMap(Map<String, dynamic> map) {
    final duck = map['duckVolume'] ?? map['duck_volume'];
    return DjBoothRealtimeEvent(
      type: (map['type'] ?? '').toString(),
      duckVolume: duck is num ? duck.toDouble() : null,
      hlsUrl: (map['hlsUrl'] ?? map['hls_url'])?.toString(),
      whepUrl: (map['whepUrl'] ?? map['whep_url'])?.toString(),
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

  /// Home station. The backend names its broadcast channel after the normalized
  /// station id, so the legacy `'global'` default subscribed to a channel
  /// nothing publishes on.
  static const String _defaultStationId = 'us-ready-now-rap';

  /// Station whose booth channel is currently subscribed.
  String _stationId = _defaultStationId;

  /// Station the listener last asked for. Tracked separately from [_stationId]
  /// so a switch requested while an earlier one is still tearing down is not
  /// mistaken for a no-op.
  String _targetStationId = _defaultStationId;

  int _switchGeneration = 0;
  Future<void> _switchQueue = Future<void>.value();

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

  Future<void> _subscribeDjBooth(SupabaseClient client) async {
    _djBoothChannel = client
        .channel('dj-booth:$_stationId')
        .onBroadcast(
          event: 'dj_booth_event',
          callback: (payload) => _emitBoothEvent(payload),
        )
        .subscribe((status, error) {
      if (error != null) {
        debugPrint('StationEventsService: dj-booth subscribe error: $error');
      }
    });
  }

  /// Re-point realtime subscriptions at [stationId] without tearing down the
  /// shared rising-star channel (uses [_stationId] in the callback filter).
  ///
  /// Switches are queued and only the newest is applied: tapping through
  /// stations otherwise interleaved channel teardown with subscribe, leaving
  /// the listener on a booth channel for a station they had already left.
  Future<void> switchStation(String stationId) {
    final trimmed = stationId.trim();
    if (trimmed.isEmpty) return Future<void>.value();
    if (_started && _targetStationId == trimmed) return Future<void>.value();

    _targetStationId = trimmed;
    final generation = ++_switchGeneration;
    final pending = _switchQueue.then(
      (_) => _applyStationSwitch(trimmed, generation),
    );
    _switchQueue = pending.catchError((Object _) {});
    return pending;
  }

  Future<void> _applyStationSwitch(String stationId, int generation) async {
    // Superseded while queued — skip the intermediate channel churn entirely.
    if (generation != _switchGeneration) return;

    SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (e) {
      debugPrint('StationEventsService: Supabase not initialized: $e');
      return;
    }

    if (!_started) {
      await start(stationId: stationId);
      return;
    }
    if (_stationId == stationId && _djBoothChannel != null) return;

    _stationId = stationId;
    final oldBooth = _djBoothChannel;
    _djBoothChannel = null;
    if (oldBooth != null) {
      try {
        await client.removeChannel(oldBooth);
      } catch (_) {}
    }
    if (generation != _switchGeneration) return;
    await _subscribeDjBooth(client);
  }

  Future<void> start({String stationId = _defaultStationId}) async {
    _stationId =
        stationId.trim().isEmpty ? _defaultStationId : stationId.trim();
    _targetStationId = _stationId;
    if (_started) return;

    SupabaseClient client;
    try {
      client = Supabase.instance.client;
    } catch (e) {
      // Do NOT mark _started — RadioBackgroundSync used to call this before
      // Supabase.initialize, which permanently skipped DJ booth realtime.
      debugPrint('StationEventsService: Supabase not initialized: $e');
      return;
    }

    _started = true;

    // DJ booth live events (mic on/off, duck volume) so listeners hear the
    // admin go live immediately instead of waiting for the 30s radio poll.
    await _subscribeDjBooth(client);

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
              final eventStation =
                  row['station_id']?.toString().trim() ?? '';
              if ((eventStation.isEmpty ? _defaultStationId : eventStation) !=
                  _stationId) {
                return;
              }
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

