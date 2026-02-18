import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:geolocator/geolocator.dart';
import '../../core/models/discovery_profile.dart';
import '../../core/services/discovery_service.dart';
import '../../core/theme/networx_extensions.dart';
import 'provider_profile_screen.dart';

class ProDirectoryScreen extends StatefulWidget {
  const ProDirectoryScreen({super.key});

  @override
  State<ProDirectoryScreen> createState() => _ProDirectoryScreenState();
}

class _ProDirectoryScreenState extends State<ProDirectoryScreen> {
  final DiscoveryService _service = DiscoveryService();

  bool _loading = true;
  List<DiscoveryProfile> _items = const [];

  String _serviceType = 'all';
  final TextEditingController _search = TextEditingController();
  final TextEditingController _minCents = TextEditingController();
  final TextEditingController _maxCents = TextEditingController();
  bool _mentorOnly = false;
  bool _nearby = false;
  double _radiusKm = 25;
  double? _lat;
  double? _lng;
  String? _nearbyStatus;

  static const serviceTypes = <String>[
    'all',
    'photo',
    'video',
    'design',
    'production',
    'marketing',
    'mixing',
    'mastering',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _minCents.dispose();
    _maxCents.dispose();
    super.dispose();
  }

  int? _parseInt(String s) {
    final v = int.tryParse(s.trim());
    if (v == null) return null;
    return v;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final minRate = _parseInt(_minCents.text);
      final maxRate = _parseInt(_maxCents.text);
      final items = await _service.listPeople(
        role: 'service_provider',
        serviceType: _serviceType == 'all' ? null : _serviceType,
        search: _search.text.trim().isEmpty ? null : _search.text.trim(),
        minRateCents: minRate,
        maxRateCents: maxRate,
        lat: _nearby ? _lat : null,
        lng: _nearby ? _lng : null,
        radiusKm: _nearby ? _radiusKm : null,
        limit: 40,
        offset: 0,
      );
      if (!mounted) return;
      setState(() {
        _items = _mentorOnly ? items.where((p) => p.mentorOptIn).toList() : items;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _ensureNearbyEnabled() async {
    setState(() => _nearbyStatus = null);
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() {
        _nearby = false;
        _nearbyStatus = 'Location services are off.';
      });
      return;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      setState(() {
        _nearby = false;
        _nearbyStatus = 'Location permission denied.';
      });
      return;
    }
    if (permission == LocationPermission.deniedForever) {
      setState(() {
        _nearby = false;
        _nearbyStatus = 'Location permission permanently denied. Enable it in settings.';
      });
      return;
    }

    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _nearby = true;
        _nearbyStatus = 'Using nearby radius ${_radiusKm.toStringAsFixed(0)} km';
      });
      await _load();
    } catch (e) {
      setState(() {
        _nearby = false;
        _nearbyStatus = 'Could not get location: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final surfaces = context.networxSurfaces;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pro-Directory'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                TextField(
                  controller: _search,
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    labelText: 'Search',
                    hintText: 'Photographer, designer, studio...',
                  ),
                  onSubmitted: (_) => _load(),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _serviceType,
                        items: serviceTypes
                            .map(
                              (s) => DropdownMenuItem(
                                value: s,
                                child: Text(s == 'all' ? 'All services' : s),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v == null) return;
                          setState(() => _serviceType = v);
                          _load();
                        },
                        decoration: const InputDecoration(labelText: 'Service'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _minCents,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Min (cents)',
                        ),
                        onSubmitted: (_) => _load(),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _maxCents,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Max (cents)',
                        ),
                        onSubmitted: (_) => _load(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Switch(
                      value: _mentorOnly,
                      onChanged: (v) {
                        setState(() => _mentorOnly = v);
                        _load();
                      },
                    ),
                    const SizedBox(width: 6),
                    Text('Mentors only', style: TextStyle(color: surfaces.textSecondary)),
                    const Spacer(),
                    FilledButton(
                      onPressed: _loading ? null : _load,
                      child: const Text('Apply'),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Switch(
                      value: _nearby,
                      onChanged: (v) async {
                        if (v) {
                          await _ensureNearbyEnabled();
                        } else {
                          setState(() {
                            _nearby = false;
                            _nearbyStatus = null;
                          });
                          _load();
                        }
                      },
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _nearby ? 'Nearby (${_radiusKm.toStringAsFixed(0)} km)' : 'Nearby',
                        style: TextStyle(color: surfaces.textSecondary),
                      ),
                    ),
                    if (_nearby)
                      SizedBox(
                        width: 160,
                        child: Slider(
                          value: _radiusKm,
                          min: 5,
                          max: 100,
                          divisions: 19,
                          label: '${_radiusKm.toStringAsFixed(0)} km',
                          onChanged: (v) => setState(() => _radiusKm = v),
                          onChangeEnd: (_) => _load(),
                        ),
                      )
                    else
                      TextButton(
                        onPressed: _ensureNearbyEnabled,
                        child: const Text('Use my location'),
                      ),
                  ],
                ),
                if (_nearbyStatus != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _nearbyStatus!,
                      style: TextStyle(color: surfaces.textMuted, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _items.isEmpty
                    ? Center(
                        child: Text(
                          'No catalysts match your filters.',
                          style: TextStyle(color: surfaces.textSecondary),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        itemCount: _items.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (context, i) {
                          final p = _items[i];
                          return Card(
                            child: ListTile(
                              leading: p.avatarUrl != null && p.avatarUrl!.isNotEmpty
                                  ? CircleAvatar(
                                      backgroundImage: CachedNetworkImageProvider(p.avatarUrl!),
                                    )
                                  : CircleAvatar(
                                      backgroundColor: scheme.primary.withValues(alpha: 0.18),
                                      child: Text(
                                        (p.displayName ?? 'C')[0].toUpperCase(),
                                        style: TextStyle(color: scheme.primary),
                                      ),
                                    ),
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      p.displayName ?? 'Industry Catalyst',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (p.mentorOptIn)
                                    Container(
                                      margin: const EdgeInsets.only(left: 8),
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: scheme.primary.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(color: scheme.primary.withValues(alpha: 0.22)),
                                      ),
                                      child: Text(
                                        'Mentor',
                                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                              color: scheme.primary,
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                    ),
                                ],
                              ),
                              subtitle: Text(
                                [
                                  if ((p.locationRegion ?? '').isNotEmpty) p.locationRegion!,
                                  if (p.distanceKm != null) '${p.distanceKm!.toStringAsFixed(1)} km',
                                  if ((p.headline ?? '').isNotEmpty) p.headline!,
                                ].join(' · '),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: surfaces.textSecondary),
                              ),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ProviderProfileScreen(userId: p.id),
                                  ),
                                );
                              },
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

