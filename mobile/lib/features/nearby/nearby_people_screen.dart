import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/services/nearby_service.dart';
import '../../core/theme/networx_tokens.dart';

class NearbyPeopleScreen extends StatefulWidget {
  const NearbyPeopleScreen({super.key});

  @override
  State<NearbyPeopleScreen> createState() => _NearbyPeopleScreenState();
}

class _NearbyPeopleScreenState extends State<NearbyPeopleScreen> {
  final NearbyService _service = NearbyService();

  bool _loading = false;
  String? _error;

  double _radiusKm = 10;
  Position? _pos;
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    _locateAndLoad();
  }

  Future<void> _locateAndLoad() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        throw Exception('Location services are disabled.');
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) {
        throw Exception('Location permission denied.');
      }
      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permission permanently denied. Enable it in Settings.');
      }

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      final res = await _service.listPeople(
        lat: pos.latitude,
        lng: pos.longitude,
        radiusKm: _radiusKm,
      );

      final rawItems = res['items'];
      final items = (rawItems is List ? rawItems : const <dynamic>[])
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();

      if (!mounted) return;
      setState(() {
        _pos = pos;
        _items = items;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby People'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _locateAndLoad,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Radius: ${_radiusKm.toStringAsFixed(0)} km',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              Slider(
                value: _radiusKm,
                min: 1,
                max: 50,
                divisions: 49,
                label: '${_radiusKm.toStringAsFixed(0)} km',
                onChanged: _loading
                    ? null
                    : (v) {
                        setState(() => _radiusKm = v);
                      },
                onChangeEnd: _loading ? null : (_) => _locateAndLoad(),
              ),
              if (_pos != null)
                Text(
                  'Using your location (${_pos!.latitude.toStringAsFixed(4)}, ${_pos!.longitude.toStringAsFixed(4)})',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                      ),
                ),
              const SizedBox(height: 12),
              if (_error != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.55)),
                  ),
                  child: Text(_error!),
                ),
              if (_loading) const LinearProgressIndicator(),
              const SizedBox(height: 12),
              Expanded(
                child: _items.isEmpty && !_loading
                    ? Center(
                        child: Text(
                          'No nearby people found.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                              ),
                        ),
                      )
                    : ListView.separated(
                        itemCount: _items.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final item = _items[index];
                          final name = (item['displayName'] ?? item['display_name'] ?? 'Unknown').toString();
                          final headline = (item['headline'] ?? '').toString();
                          final location = (item['locationRegion'] ?? item['location_region'] ?? '').toString();
                          final dist = item['distanceKm'] ?? item['distance_km'];
                          final distText = dist is num ? '${dist.toDouble().toStringAsFixed(1)} km' : null;

                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: NetworxTokens.electricCyan.withValues(alpha: 0.18)),
                              boxShadow: [
                                BoxShadow(
                                  color: NetworxTokens.electricCyan.withValues(alpha: 0.10),
                                  blurRadius: 24,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 22,
                                  backgroundColor: NetworxTokens.electricCyan.withValues(alpha: 0.15),
                                  child: const Icon(Icons.person_outline),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              name,
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleSmall
                                                  ?.copyWith(fontWeight: FontWeight.w800),
                                            ),
                                          ),
                                          if (distText != null)
                                            Text(
                                              distText,
                                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                            ),
                                        ],
                                      ),
                                      if (headline.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            headline,
                                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.85),
                                                ),
                                          ),
                                        ),
                                      if (location.isNotEmpty)
                                        Padding(
                                          padding: const EdgeInsets.only(top: 4),
                                          child: Text(
                                            location,
                                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                                                ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

