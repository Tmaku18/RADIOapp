import 'package:flutter/material.dart';

import '../../core/models/studio_models.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/services/studio_service.dart';
import '../../core/theme/networx_tokens.dart';
import '../../widgets/dimension/dimension_widgets.dart';

const _amenityOptions = [
  'Live room',
  'Vocal booth',
  'Isolation booth',
  'Mixing desk',
  'Monitor speakers',
  'Piano',
  'Drums',
  'Guitar amps',
  'Engineer included',
  'Parking',
  'Wi-Fi',
  'ADA accessible',
];

const _rateUnits = ['hour', 'day', 'half_day', 'session'];

class MyStudioScreen extends StatefulWidget {
  const MyStudioScreen({super.key});

  @override
  State<MyStudioScreen> createState() => _MyStudioScreenState();
}

class _MyStudioScreenState extends State<MyStudioScreen> {
  final StudioService _service = StudioService();
  List<Studio> _items = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await _service.listMine();
      if (!mounted) return;
      setState(() => _items = items);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openEditor({Studio? existing}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _StudioEditorScreen(existing: existing),
      ),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: 'My studio',
      showNeonLine: true,
      actions: [
        IconButton(
          tooltip: 'Add studio',
          onPressed: () => _openEditor(),
          icon: const Icon(Icons.add),
        ),
      ],
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(child: Text(_error!))
          : _items.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Set up a studio page with a rate card so artists can find you on the map.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => _openEditor(),
                      child: const Text('Create studio page'),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                itemCount: _items.length,
                itemBuilder: (context, i) {
                  final s = _items[i];
                  return Card(
                    child: ListTile(
                      leading: const Icon(
                        Icons.apartment,
                        color: NetworxTokens.warning,
                      ),
                      title: Text(s.name),
                      subtitle: Text(
                        [
                          if (s.startingAtLabel != null) s.startingAtLabel,
                          s.isPublished ? 'Published' : 'Hidden',
                          s.isExact ? 'Exact pin' : 'Approximate area',
                        ].whereType<String>().join(' · '),
                      ),
                      trailing: const Icon(Icons.edit_outlined),
                      onTap: () => _openEditor(existing: s),
                      onLongPress: () {
                        Navigator.pushNamed(
                          context,
                          AppRoutes.studioProfile,
                          arguments: s.id,
                        );
                      },
                    ),
                  );
                },
              ),
            ),
    );
  }
}

class _RateDraft {
  _RateDraft({String label = '', String dollars = '', this.unit = 'hour'})
    : label = TextEditingController(text: label),
      dollars = TextEditingController(text: dollars);
  final TextEditingController label;
  final TextEditingController dollars;
  String unit;

  void dispose() {
    label.dispose();
    dollars.dispose();
  }
}

class _StudioEditorScreen extends StatefulWidget {
  const _StudioEditorScreen({this.existing});
  final Studio? existing;

  @override
  State<_StudioEditorScreen> createState() => _StudioEditorScreenState();
}

class _StudioEditorScreenState extends State<_StudioEditorScreen> {
  final StudioService _service = StudioService();
  final _name = TextEditingController();
  final _tagline = TextEditingController();
  final _about = TextEditingController();
  final _hero = TextEditingController();
  final _address1 = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _zip = TextEditingController();
  final _booking = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();

  bool _exact = false;
  bool _published = true;
  bool _saving = false;
  String? _error;
  final Set<String> _amenities = {};
  final List<_RateDraft> _rates = [];

  @override
  void initState() {
    super.initState();
    final s = widget.existing;
    if (s != null) {
      _name.text = s.name;
      _tagline.text = s.tagline ?? '';
      _about.text = s.about ?? '';
      _hero.text = s.heroImageUrl ?? '';
      _address1.text = s.addressLine1 ?? '';
      _city.text = s.city ?? '';
      _state.text = s.state ?? '';
      _zip.text = s.zipCode ?? '';
      _booking.text = s.bookingLink ?? '';
      _email.text = s.contactEmail ?? '';
      _phone.text = s.contactPhone ?? '';
      _exact = s.isExact;
      _published = s.isPublished;
      _amenities.addAll(s.amenities);
      for (final r in s.rates) {
        _rates.add(
          _RateDraft(
            label: r.label,
            dollars: (r.priceCents / 100).toStringAsFixed(
              r.priceCents % 100 == 0 ? 0 : 2,
            ),
            unit: r.unit,
          ),
        );
      }
    }
    if (_rates.isEmpty) {
      _rates.add(_RateDraft(label: 'Studio time'));
    }
  }

  @override
  void dispose() {
    for (final r in _rates) {
      r.dispose();
    }
    _name.dispose();
    _tagline.dispose();
    _about.dispose();
    _hero.dispose();
    _address1.dispose();
    _city.dispose();
    _state.dispose();
    _zip.dispose();
    _booking.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Map<String, dynamic> _payload() {
    final rates = <Map<String, dynamic>>[];
    for (final r in _rates) {
      final label = r.label.text.trim();
      final dollars = double.tryParse(r.dollars.text.trim());
      if (label.isEmpty || dollars == null) continue;
      rates.add({
        'label': label,
        'priceCents': (dollars * 100).round(),
        'unit': r.unit,
      });
    }
    return {
      'name': _name.text.trim(),
      'tagline': _tagline.text.trim(),
      'about': _about.text.trim(),
      'heroImageUrl': _hero.text.trim(),
      'addressLine1': _address1.text.trim(),
      'city': _city.text.trim(),
      'state': _state.text.trim(),
      'zipCode': _zip.text.trim(),
      'locationPrecision': _exact ? 'exact' : 'approximate',
      'bookingLink': _booking.text.trim(),
      'contactEmail': _email.text.trim(),
      'contactPhone': _phone.text.trim(),
      'isPublished': _published,
      'amenities': _amenities.toList(),
      'rates': rates,
    };
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final payload = _payload();
      final existing = widget.existing;
      if (existing == null) {
        await _service.create(payload);
      } else {
        await _service.update(existing.id, payload);
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final existing = widget.existing;
    if (existing == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this studio?'),
        content: const Text('This removes the studio page and its map pin.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await _service.remove(existing.id);
    if (!mounted) return;
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return DimensionScreenShell(
      title: widget.existing == null ? 'New studio' : 'Edit studio',
      showNeonLine: true,
      actions: [
        if (widget.existing != null)
          IconButton(
            tooltip: 'Delete',
            onPressed: _saving ? null : _delete,
            icon: const Icon(Icons.delete_outline),
          ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ),
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Studio name'),
          ),
          TextField(
            controller: _tagline,
            decoration: const InputDecoration(labelText: 'Tagline'),
          ),
          TextField(
            controller: _about,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'About'),
          ),
          TextField(
            controller: _hero,
            decoration: const InputDecoration(labelText: 'Hero image URL'),
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Show exact street address on the map'),
            subtitle: Text(
              _exact
                  ? 'Clients see your street pin and address.'
                  : 'Only a general ZIP area is shown, like people pins.',
            ),
            value: _exact,
            onChanged: (v) => setState(() => _exact = v),
          ),
          if (_exact)
            TextField(
              controller: _address1,
              decoration: const InputDecoration(labelText: 'Street address'),
            ),
          TextField(
            controller: _city,
            decoration: const InputDecoration(labelText: 'City'),
          ),
          TextField(
            controller: _state,
            decoration: const InputDecoration(labelText: 'State'),
          ),
          TextField(
            controller: _zip,
            decoration: const InputDecoration(labelText: 'ZIP'),
          ),
          const SizedBox(height: 20),
          Text(
            'Amenities',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          Wrap(
            spacing: 8,
            children: [
              for (final a in _amenityOptions)
                FilterChip(
                  label: Text(a),
                  selected: _amenities.contains(a),
                  onSelected: (on) {
                    setState(() {
                      if (on) {
                        _amenities.add(a);
                      } else {
                        _amenities.remove(a);
                      }
                    });
                  },
                ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Text(
                'Rates',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => setState(() => _rates.add(_RateDraft())),
                child: const Text('Add rate'),
              ),
            ],
          ),
          for (var i = 0; i < _rates.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: TextField(
                      decoration: const InputDecoration(labelText: 'Label'),
                      controller: _rates[i].label,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: TextField(
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(labelText: r'$'),
                      controller: _rates[i].dollars,
                    ),
                  ),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: _rates[i].unit,
                    items: [
                      for (final u in _rateUnits)
                        DropdownMenuItem(
                          value: u,
                          child: Text(StudioRate.unitLabel(u)),
                        ),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() => _rates[i].unit = v);
                    },
                  ),
                  IconButton(
                    onPressed: _rates.length == 1
                        ? null
                        : () => setState(() => _rates.removeAt(i).dispose()),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
          TextField(
            controller: _booking,
            decoration: const InputDecoration(labelText: 'Booking link'),
          ),
          TextField(
            controller: _email,
            decoration: const InputDecoration(labelText: 'Contact email'),
          ),
          TextField(
            controller: _phone,
            decoration: const InputDecoration(labelText: 'Contact phone'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Published on the map'),
            value: _published,
            onChanged: (v) => setState(() => _published = v),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save studio'),
          ),
        ],
      ),
    );
  }
}
