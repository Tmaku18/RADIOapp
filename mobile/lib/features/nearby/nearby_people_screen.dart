import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart' show Position;
import 'package:latlong2/latlong.dart';

import '../../core/navigation/app_routes.dart';
import '../../core/services/location_permission_service.dart';
import '../../core/services/nearby_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';
import 'nearby_grouping.dart';

enum _NearbyKindFilter { all, studios, artists, catalysts, listeners }

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

  /// Fallback when the API omits `vicinityRadiusKm`; must not read as more
  /// precise than the backend's own approximation radius.
  static const double _fallbackVicinityKm = 3;

  late final TabController _tabs;
  final MapController _mapController = MapController();

  bool _loading = false;
  String? _error;
  double _radiusMiles = 25;
  _NearbyKindFilter _kindFilter = _NearbyKindFilter.all;
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
      final include = switch (_kindFilter) {
        _NearbyKindFilter.studios => 'studios',
        _NearbyKindFilter.all => 'all',
        _ => 'people',
      };
      final role = switch (_kindFilter) {
        _NearbyKindFilter.artists => 'artist',
        _NearbyKindFilter.catalysts => 'service_provider',
        _NearbyKindFilter.listeners => 'listener',
        _ => null,
      };
      final res = await _service.listDirectory(
        lat: pos?.latitude,
        lng: pos?.longitude,
        radiusKm: applyRadius && pos != null
            ? _radiusMiles * _kmPerMile
            : null,
        limit: 300,
        include: include,
        role: role,
      );

      final items = asMapList(res['items']);
      // Prefer server groups when present; otherwise build from items so
      // By city / By ZIP stay in sync with the map (older APIs omit groups).
      var byCity = asMapList(res['byCity'] ?? res['by_city']);
      var byZip = asMapList(res['byZip'] ?? res['by_zip']);
      if (items.isNotEmpty &&
          (byCity.isEmpty || !groupsHavePeople(byCity))) {
        byCity = groupNearbyByCity(items);
      }
      if (items.isNotEmpty &&
          (byZip.isEmpty || !groupsHavePeople(byZip))) {
        byZip = groupNearbyByZip(items);
      }

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
      (item['displayName'] ??
              item['display_name'] ??
              item['name'] ??
              'Unknown')
          .toString();

  String _headline(Map<String, dynamic> item) =>
      (item['headline'] ?? '').toString();

  String? _distText(Map<String, dynamic> item) {
    final distKm = item['distanceKm'] ?? item['distance_km'];
    if (distKm is num) {
      return '${(distKm.toDouble() / _kmPerMile).toStringAsFixed(1)} mi';
    }
    return null;
  }

  void _openDirectoryItem(Map<String, dynamic> item) {
    final id = directoryItemId(item);
    if (id == null) return;
    if (isStudioItem(item)) {
      Navigator.pushNamed(context, AppRoutes.studioProfile, arguments: id);
      return;
    }
    Navigator.pushNamed(
      context,
      AppRoutes.artistProfile,
      arguments: id,
    );
  }

  double _vicinityKm(Map<String, dynamic> item) =>
      _asDouble(item['vicinityRadiusKm']) ?? _fallbackVicinityKm;

  /// Shaded areas rather than pins: a person sits somewhere inside their
  /// circle, so a sharp pin would claim precision the data doesn't have.
  List<CircleMarker> get _vicinityCircles {
    final circles = <CircleMarker>[];
    for (final item in _items) {
      final lat = _asDouble(item['lat']);
      final lng = _asDouble(item['lng']);
      if (lat == null || lng == null) continue;
      // Exact studios publish a street pin — no vicinity circle.
      if (isStudioItem(item) && item['vicinityRadiusKm'] == null) continue;
      final color = isStudioItem(item)
          ? NetworxTokens.warning
          : NetworxTokens.electricCyan;
      circles.add(
        CircleMarker(
          point: LatLng(lat, lng),
          radius: _vicinityKm(item) * 1000,
          useRadiusInMeter: true,
          color: color.withValues(alpha: 0.14),
          borderColor: color.withValues(alpha: 0.65),
          borderStrokeWidth: 1.5,
        ),
      );
    }
    return circles;
  }

  List<Marker> get _markers {
    final markers = <Marker>[];
    for (final item in _items) {
      final lat = _asDouble(item['lat']);
      final lng = _asDouble(item['lng']);
      if (lat == null || lng == null) continue;
      final studio = isStudioItem(item);
      final accent = studio
          ? NetworxTokens.warning
          : NetworxTokens.electricCyan;
      markers.add(
        Marker(
          point: LatLng(lat, lng),
          width: 34,
          height: 34,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _openDirectoryItem(item),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                shape: BoxShape.circle,
                border: Border.all(
                  color: accent,
                  width: 2,
                ),
              ),
              child: Icon(
                studio ? Icons.apartment : Icons.person,
                color: accent,
                size: 18,
              ),
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
      title: 'Nearby',
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
                      'No one nearby yet. Set your ZIP in Profile, or add a '
                      'studio page so it can appear on the map.',
                ),
                _buildGroupList(
                  context,
                  groups: _byZip,
                  emptyLabel:
                      'No ZIP codes yet. Add your ZIP in Profile to show up '
                      'here as an approximate area.',
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
                'People pins are a general ZIP area — never an exact address. '
                'Studios may publish an exact street pin if the owner opts in. '
                '${_pos != null ? 'Green mark is you (for centering only).' : 'Enable location to center the map on you.'}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.onSurface.withValues(alpha: 0.7),
                    ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final f in _NearbyKindFilter.values)
                    ChoiceChip(
                      label: Text(switch (f) {
                        _NearbyKindFilter.all => 'All',
                        _NearbyKindFilter.studios => 'Studios',
                        _NearbyKindFilter.artists => 'Artists',
                        _NearbyKindFilter.catalysts => 'Catalysts',
                        _NearbyKindFilter.listeners => 'Listeners',
                      }),
                      selected: _kindFilter == f,
                      onSelected: _loading
                          ? null
                          : (on) {
                              if (!on) return;
                              setState(() => _kindFilter = f);
                              _loadDirectory();
                            },
                    ),
                ],
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
                  ? 'Nothing nearby yet. Try Show all, or set your ZIP in Profile.'
                  : 'People are listed by city, but map areas aren’t ready yet. Pull refresh in a moment.',
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
                CircleLayer(circles: _vicinityCircles),
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
              : asMapList(group['people']).length;
          final people = asMapList(group['people']);
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
              subtitle: Text('$count ${count == 1 ? 'listing' : 'listings'}'),
              children: people.map((person) {
                final name = _name(person);
                final headline = _headline(person);
                final zip = personZip(person);
                final cityName = personCity(person);
                final dist = _distText(person);
                final studio = isStudioItem(person);
                final accent = studio
                    ? NetworxTokens.warning
                    : NetworxTokens.electricCyan;
                final locationBits = [
                  if (studio) 'Studio',
                  if (!isZip && zip.isNotEmpty) zip,
                  if (isZip && cityName.isNotEmpty) cityName,
                ].join(' · ');

                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: accent.withValues(alpha: 0.15),
                    child: Icon(
                      studio ? Icons.apartment : Icons.person_outline,
                      color: accent,
                    ),
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
                      : const Icon(Icons.chevron_right),
                  onTap: () => _openDirectoryItem(person),
                );
              }).toList(),
            ),
          );
        },
      ),
    );
  }
}
