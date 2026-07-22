import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart' show Position;
import 'package:latlong2/latlong.dart';

import '../../core/services/location_permission_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

class NearbyPeopleScreen extends StatefulWidget {
  const NearbyPeopleScreen({super.key});

  @override
  State<NearbyPeopleScreen> createState() => _NearbyPeopleScreenState();
}

class _NearbyPeopleScreenState extends State<NearbyPeopleScreen>
    with SingleTickerProviderStateMixin {
  final NearbyService _service = NearbyService();
  static const double _kmPerMile = 1.609344;
  static const LatLng _fallbackCenter = LatLng(39.8283, -98.5795); // US

  late final TabController _tabs;
  final MapController _mapController = MapController();

  bool _loading = false;
  String? _error;
  double _radiusMiles = 25;
  Position? _pos;

  List<Map<String, dynamic>> _items = const [];
  List<Map<String, dynamic>> _byCity = const [];
  List<Map<String, dynamic>> _byZip = const [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _loadDirectory();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _loadDirectory({bool applyRadius = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final pos = await LocationPermissionService.instance.getPositionIfAllowed();
      final res = await _service.listDirectory(
        lat: pos?.latitude,
        lng: pos?.longitude,
        radiusKm: applyRadius && pos != null
            ? _radiusMiles * _kmPerMile
            : null,
        limit: 300,
      );

      final items = _asMapList(res['items']);
      final byCity = _asMapList(res['byCity']);
      final byZip = _asMapList(res['byZip']);

      if (!mounted) return;
      setState(() {
        _pos = pos;
        _items = items;
        _byCity = byCity;
        _byZip = byZip;
      });

      final center = _mapCenter(items, pos);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        try {
          _mapController.move(center, pos != null ? 10 : 4);
        } catch (_) {}
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _asMapList(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();
  }

  LatLng _mapCenter(List<Map<String, dynamic>> items, Position? pos) {
    if (pos != null) return LatLng(pos.latitude, pos.longitude);
    for (final item in items) {
      final lat = _asDouble(item['lat']);
      final lng = _asDouble(item['lng']);
      if (lat != null && lng != null) return LatLng(lat, lng);
    }
    return _fallbackCenter;
  }

  double? _asDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '');
  }

  String _name(Map<String, dynamic> item) =>
      (item['displayName'] ?? item['display_name'] ?? 'Unknown').toString();

  String _headline(Map<String, dynamic> item) =>
      (item['headline'] ?? '').toString();

  String _city(Map<String, dynamic> item) =>
      (item['city'] ?? '').toString().trim();

  String _zip(Map<String, dynamic> item) =>
      (item['zipCode'] ?? item['zip_code'] ?? '').toString().trim();

  String? _distText(Map<String, dynamic> item) {
    final distKm = item['distanceKm'] ?? item['distance_km'];
    if (distKm is num) {
      return '${(distKm.toDouble() / _kmPerMile).toStringAsFixed(1)} mi';
    }
    return null;
  }

  List<Marker> get _markers {
    final markers = <Marker>[];
    for (final item in _items) {
      final lat = _asDouble(item['lat']);
      final lng = _asDouble(item['lng']);
      if (lat == null || lng == null) continue;
      final name = _name(item);
      final city = _city(item);
      markers.add(
        Marker(
          point: LatLng(lat, lng),
          width: 44,
          height: 44,
          child: GestureDetector(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    city.isEmpty ? name : '$name · $city',
                  ),
                ),
              );
            },
            child: const Icon(
              Icons.location_on,
              color: NetworxTokens.electricCyan,
              size: 40,
              shadows: [
                Shadow(color: Colors.black54, blurRadius: 6),
              ],
            ),
          ),
        ),
      );
    }
    if (_pos != null) {
      markers.add(
        Marker(
          point: LatLng(_pos!.latitude, _pos!.longitude),
          width: 36,
          height: 36,
          child: const Icon(
            Icons.my_location,
            color: Colors.lightGreenAccent,
            size: 28,
          ),
        ),
      );
    }
    return markers;
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'Nearby People',
      showNeonLine: true,
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : () => _loadDirectory(),
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: Column(
        children: [
          TabBar(
            controller: _tabs,
            tabs: const [
              Tab(text: 'Map'),
              Tab(text: 'By city'),
              Tab(text: 'By ZIP'),
            ],
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.redAccent.withValues(alpha: 0.55),
                  ),
                ),
                child: Text(_error!),
              ),
            ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _buildMapTab(context),
                _buildGroupList(
                  context,
                  groups: _byCity,
                  emptyLabel:
                      'No one nearby yet. Set your city in Profile to appear '
                      'on the map (approximate area only).',
                ),
                _buildGroupList(
                  context,
                  groups: _byZip,
                  emptyLabel:
                      'No ZIP codes yet. Add your city or ZIP in Profile to '
                      'show up here.',
                  isZip: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapTab(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Pins show an approximate city area — not exact addresses or live GPS. '
                '${_pos != null ? 'Green mark is you (for centering only).' : 'Enable location to center the map on you.'}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.onSurface.withValues(alpha: 0.7),
                    ),
              ),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Nearby filter: ${_radiusMiles.toStringAsFixed(0)} mi',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  TextButton(
                    onPressed: _loading
                        ? null
                        : () => _loadDirectory(applyRadius: false),
                    child: const Text('Show all'),
                  ),
                ],
              ),
              Slider(
                value: _radiusMiles,
                min: 5,
                max: 100,
                divisions: 19,
                label: '${_radiusMiles.toStringAsFixed(0)} mi',
                onChanged: _loading
                    ? null
                    : (v) => setState(() => _radiusMiles = v),
                onChangeEnd: _loading
                    ? null
                    : (_) => _loadDirectory(applyRadius: true),
              ),
            ],
          ),
        ),
        if (!_loading && _items.where((i) => _asDouble(i['lat']) != null).isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              _items.isEmpty
                  ? 'No discoverable people found. Try Show all, or set your city in Profile.'
                  : 'People are listed by city, but map pins aren’t ready yet. Pull refresh in a moment.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: scheme.onSurface.withValues(alpha: 0.65),
                  ),
            ),
          ),
        Expanded(
          child: ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _mapCenter(_items, _pos),
                initialZoom: _pos != null ? 9 : 4,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.tmaktechnologies.networxradio',
                ),
                MarkerLayer(markers: _markers),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGroupList(
    BuildContext context, {
    required List<Map<String, dynamic>> groups,
    required String emptyLabel,
    bool isZip = false,
  }) {
    if (!_loading && groups.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            emptyLabel,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.7),
                ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadDirectory(),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        itemCount: groups.length,
        itemBuilder: (context, index) {
          final group = groups[index];
          final label = (group['label'] ?? '').toString();
          final city = (group['city'] ?? '').toString();
          final count = group['count'] is num
              ? (group['count'] as num).toInt()
              : _asMapList(group['people']).length;
          final people = _asMapList(group['people']);
          final title = isZip
              ? (city.isNotEmpty ? '$label · $city' : 'ZIP $label')
              : label;

          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ExpansionTile(
              initiallyExpanded: index == 0 && groups.length <= 8,
              title: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text('$count ${count == 1 ? 'person' : 'people'}'),
              children: people.map((person) {
                final name = _name(person);
                final headline = _headline(person);
                final zip = _zip(person);
                final cityName = _city(person);
                final dist = _distText(person);
                final locationBits = [
                  if (!isZip && zip.isNotEmpty) zip,
                  if (isZip && cityName.isNotEmpty) cityName,
                ].join(' · ');

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor:
                        NetworxTokens.electricCyan.withValues(alpha: 0.15),
                    child: const Icon(Icons.person_outline),
                  ),
                  title: Text(name),
                  subtitle: Text(
                    [
                      if (headline.isNotEmpty) headline,
                      if (locationBits.isNotEmpty) locationBits,
                    ].join('\n'),
                  ),
                  isThreeLine: headline.isNotEmpty && locationBits.isNotEmpty,
                  trailing: dist != null
                      ? Text(
                          dist,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        )
                      : null,
                );
              }).toList(),
            ),
          );
        },
      ),
    );
  }
}
